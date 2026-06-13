#!/usr/bin/env python3
"""Relatório de uso de tokens de uma sessão do Claude Code.

Lê o transcript JSONL que o Claude Code grava por sessão
(`~/.claude/projects/<projeto>/<session>.jsonl`) e gera:

- Totais da sessão por tipo de token (input, output, cache read/creation).
- Tokens de output agrupados por *atividade* (leitura, escrita, execução,
  git/PR, raciocínio...), inferida pelas ferramentas usadas em cada turno.
- Contagem de chamadas por ferramenta.
- Resumo de turnos com pensamento ("thinking").
- Opcional: custo estimado, se você informar os preços por 1M de tokens.

LIMITAÇÃO: os tokens são contabilizados por requisição (1 turno = 1 chamada à
API), não por ação individual. Um turno pode misturar pensamento + texto +
várias ferramentas, então a atribuição por atividade é uma APROXIMAÇÃO: o
output do turno inteiro é creditado à(s) ferramenta(s) daquele turno. Não há
como isolar com exatidão "os tokens de um pensamento" ou "de uma leitura"
específicos dentro de um mesmo turno.

Uso:
    python scripts/token-report.py                 # sessão mais recente
    python scripts/token-report.py CAMINHO.jsonl   # transcript específico
    python scripts/token-report.py --by-turn       # tabela turno a turno
    python scripts/token-report.py --json           # saída JSON
    python scripts/token-report.py \\
        --price-in 3 --price-out 15 \\
        --price-cache-read 0.3 --price-cache-write 3.75   # custo estimado (US$/1M)
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

DEFAULT_PROJECTS_DIR = Path.home() / ".claude" / "projects"

READ_TOOLS = {"Read", "Grep", "Glob", "NotebookRead"}
WRITE_TOOLS = {"Edit", "Write", "NotebookEdit", "MultiEdit"}


def find_latest_transcript(projects_dir: Path) -> Path | None:
    """Retorna o .jsonl modificado mais recentemente sob projects_dir."""
    candidates = list(projects_dir.rglob("*.jsonl"))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def classify_activity(tool_names: list[str]) -> str:
    """Rotula um turno por atividade a partir das ferramentas que ele usou."""
    if not tool_names:
        return "raciocínio/resposta"
    cats: set[str] = set()
    for name in set(tool_names):
        if name in READ_TOOLS:
            cats.add("leitura/exploração")
        elif name in WRITE_TOOLS:
            cats.add("escrita de arquivos")
        elif name == "Bash":
            cats.add("execução (bash)")
        elif name == "ToolSearch":
            cats.add("descoberta de ferramentas")
        elif name == "AskUserQuestion":
            cats.add("decisão (pergunta)")
        elif name == "Task" or name == "Agent":
            cats.add("subagente")
        elif name.startswith("mcp__github__"):
            cats.add("git/PR (github)")
        elif name.startswith("mcp__"):
            cats.add("mcp")
        else:
            cats.add(name)
    return " + ".join(sorted(cats))


def iter_assistant_messages(transcript: Path):
    """Itera (usage, content) de cada registro do tipo 'assistant'."""
    with transcript.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if record.get("type") != "assistant":
                continue
            message = record.get("message") or {}
            usage = message.get("usage") or {}
            content = message.get("content") or []
            yield usage, content


def analyze(transcript: Path) -> dict:
    totals = Counter()
    tool_calls = Counter()
    out_by_activity = Counter()
    out_by_tool = Counter()
    turns = 0
    turns_with_thinking = 0
    out_thinking_turns = 0
    per_turn: list[dict] = []

    for usage, content in iter_assistant_messages(transcript):
        turns += 1
        inp = usage.get("input_tokens", 0) or 0
        out = usage.get("output_tokens", 0) or 0
        cache_read = usage.get("cache_read_input_tokens", 0) or 0
        cache_creation = usage.get("cache_creation_input_tokens", 0) or 0
        totals["input"] += inp
        totals["output"] += out
        totals["cache_read"] += cache_read
        totals["cache_creation"] += cache_creation

        has_thinking = any(
            isinstance(b, dict) and b.get("type") == "thinking" for b in content
        )
        tools = [
            b.get("name")
            for b in content
            if isinstance(b, dict) and b.get("type") == "tool_use"
        ]
        if has_thinking:
            turns_with_thinking += 1
            out_thinking_turns += out
        for name in tools:
            tool_calls[name] += 1
            out_by_tool[name] += out

        activity = classify_activity(tools)
        out_by_activity[activity] += out
        per_turn.append(
            {
                "turn": turns,
                "activity": activity,
                "tools": tools,
                "thinking": has_thinking,
                "input": inp,
                "output": out,
                "cache_read": cache_read,
                "cache_creation": cache_creation,
            }
        )

    return {
        "transcript": str(transcript),
        "turns": turns,
        "totals": dict(totals),
        "tool_calls": dict(tool_calls),
        "out_by_activity": dict(out_by_activity),
        "out_by_tool": dict(out_by_tool),
        "turns_with_thinking": turns_with_thinking,
        "out_thinking_turns": out_thinking_turns,
        "per_turn": per_turn,
    }


def estimate_cost(totals: dict, prices: dict) -> dict | None:
    """Custo estimado em US$, dados preços por 1M de tokens. None se sem preços."""
    if not any(prices.values()):
        return None
    cost = {
        "input": totals.get("input", 0) / 1_000_000 * (prices["in"] or 0),
        "output": totals.get("output", 0) / 1_000_000 * (prices["out"] or 0),
        "cache_read": totals.get("cache_read", 0)
        / 1_000_000
        * (prices["cache_read"] or 0),
        "cache_creation": totals.get("cache_creation", 0)
        / 1_000_000
        * (prices["cache_write"] or 0),
    }
    cost["total"] = sum(cost.values())
    return cost


def fmt(n: int | float) -> str:
    if isinstance(n, float):
        return f"{n:,.4f}"
    return f"{n:,}"


def print_report(data: dict, prices: dict, by_turn: bool) -> None:
    totals = data["totals"]
    print(f"Transcript: {data['transcript']}")
    print(f"Turnos (requisições à API): {data['turns']}\n")

    print("== TOTAIS POR TIPO DE TOKEN ==")
    rows = [
        ("input (não-cacheado)", totals.get("input", 0)),
        ("output (inclui pensamento)", totals.get("output", 0)),
        ("cache read (contexto relido)", totals.get("cache_read", 0)),
        ("cache creation (escrita no cache)", totals.get("cache_creation", 0)),
    ]
    for label, value in rows:
        print(f"  {label:36}: {fmt(value):>14}")

    print("\n== OUTPUT TOKENS POR ATIVIDADE (aproximado) ==")
    for activity, value in sorted(
        data["out_by_activity"].items(), key=lambda kv: kv[1], reverse=True
    ):
        print(f"  {activity:36}: {fmt(value):>14}")

    print("\n== CHAMADAS POR FERRAMENTA ==")
    for name, count in sorted(
        data["tool_calls"].items(), key=lambda kv: kv[1], reverse=True
    ):
        out = data["out_by_tool"].get(name, 0)
        print(f"  {name:34}: {count:>4} chamadas · output {fmt(out):>12}")

    print(
        f"\n== PENSAMENTO ==\n  turnos com thinking: {data['turns_with_thinking']}"
        f"  ·  output desses turnos: {fmt(data['out_thinking_turns'])}"
    )

    cost = estimate_cost(totals, prices)
    if cost:
        print("\n== CUSTO ESTIMADO (US$) ==")
        for key in ("input", "output", "cache_read", "cache_creation"):
            print(f"  {key:36}: {fmt(cost[key]):>14}")
        print(f"  {'TOTAL':36}: {fmt(cost['total']):>14}")

    if by_turn:
        print("\n== TURNO A TURNO ==")
        print(f"  {'#':>4}  {'output':>8}  {'thinking':>8}  atividade")
        for turn in data["per_turn"]:
            print(
                f"  {turn['turn']:>4}  {turn['output']:>8,}  "
                f"{'sim' if turn['thinking'] else '-':>8}  {turn['activity']}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "transcript",
        nargs="?",
        help="Caminho do .jsonl. Se omitido, usa a sessão mais recente.",
    )
    parser.add_argument(
        "--projects-dir",
        type=Path,
        default=DEFAULT_PROJECTS_DIR,
        help=f"Diretório de projetos do Claude Code (padrão: {DEFAULT_PROJECTS_DIR}).",
    )
    parser.add_argument("--by-turn", action="store_true", help="Tabela turno a turno.")
    parser.add_argument("--json", action="store_true", help="Saída em JSON.")
    parser.add_argument("--price-in", type=float, default=0.0, help="US$/1M input.")
    parser.add_argument("--price-out", type=float, default=0.0, help="US$/1M output.")
    parser.add_argument(
        "--price-cache-read", type=float, default=0.0, help="US$/1M cache read."
    )
    parser.add_argument(
        "--price-cache-write", type=float, default=0.0, help="US$/1M cache creation."
    )
    args = parser.parse_args()

    if args.transcript:
        transcript = Path(args.transcript)
    else:
        transcript = find_latest_transcript(args.projects_dir)
        if transcript is None:
            parser.error(
                f"Nenhum transcript .jsonl encontrado em {args.projects_dir}. "
                "Informe o caminho explicitamente."
            )

    if not transcript.is_file():
        parser.error(f"Transcript não encontrado: {transcript}")

    prices = {
        "in": args.price_in,
        "out": args.price_out,
        "cache_read": args.price_cache_read,
        "cache_write": args.price_cache_write,
    }

    data = analyze(transcript)

    if args.json:
        cost = estimate_cost(data["totals"], prices)
        if cost:
            data["estimated_cost_usd"] = cost
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print_report(data, prices, args.by_turn)


if __name__ == "__main__":
    main()
