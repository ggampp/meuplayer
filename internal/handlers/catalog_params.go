package handlers

import (
	"fmt"
	"math"
	"strconv"
)

func catalogPage(raw string) (int, error) {
	if raw == "" {
		return 1, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > 500 {
		return 0, fmt.Errorf("Página deve estar entre 1 e 500")
	}
	return n, nil
}

func catalogYear(raw string) (string, error) {
	if raw == "" {
		return "", nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1900 || n > 2100 {
		return "", fmt.Errorf("Ano deve estar entre 1900 e 2100")
	}
	return strconv.Itoa(n), nil
}

func catalogRating(raw string) (string, error) {
	if raw == "" {
		return "", nil
	}
	n, err := strconv.ParseFloat(raw, 64)
	if err != nil || math.IsNaN(n) || math.IsInf(n, 0) || n < 0 || n > 10 {
		return "", fmt.Errorf("Nota deve estar entre 0 e 10")
	}
	return strconv.FormatFloat(n, 'f', -1, 64), nil
}
