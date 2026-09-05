import assert from 'node:assert/strict';
import { filterChannels, extractChannels, normalizeChannel } from '../src/modules/tv/channels';
import { matchesSearch } from '../src/shared/lib/search';
import { sortVodItems } from '../src/modules/vod/lib/search';
import { itemMatchesStatus } from '../src/modules/vod/lib/media';

const channels = [
  { id: '1', nome: 'Notícias Brasil', category: 'Jornalismo', src: 'https://example.com/1' },
  { id: '2', nome: 'Cinema Brasil', category: 'Filmes', src: 'https://example.com/2' },
  { id: '3', nome: 'Notícias Mundo', category: 'Jornalismo', src: 'https://example.com/3' },
];
assert.deepEqual(filterChannels(channels, 'noticias brasil', 'Jornalismo', true, new Set(['1','2']), 'asc').map(c=>c.id), ['1']);
assert.deepEqual(filterChannels(channels, 'brasil', 'Filmes', false, new Set(), 'asc').map(c=>c.id), ['2']);
assert.deepEqual(filterChannels(channels, '', '', false, new Set(), 'desc').map(c=>c.id), ['3','1','2']);
assert.equal(filterChannels(channels, 'inexistente', '', false, new Set(), 'asc').length, 0);
assert.equal(matchesSearch('Ação e aventura', 'aventura acao'), true);
assert.equal(normalizeChannel({id:'adult', category_id:'adulto'}), null);
assert.equal(normalizeChannel({id:'bad',src:'javascript:alert(1)'}), null);
assert.equal(extractChannels({data:{channels:[{id:1,name:'Canal'}]}}).length, 1);
assert.throws(()=>extractChannels({success:false}));
const items = [
  {id:'1', type:'movie' as const, meta:{title:'Zulu',vote_average:5,release_date:'2020-01-01'}},
  {id:'2', type:'movie' as const, meta:{title:'Aurora',vote_average:8,release_date:'2025-01-01'}},
];
assert.deepEqual(sortVodItems(items,'rating').map(i=>i.id),['2','1']);
assert.deepEqual(sortVodItems(items,'title').map(i=>i.id),['2','1']);
assert.deepEqual(sortVodItems(items,'release').map(i=>i.id),['2','1']);
assert.deepEqual(sortVodItems(items,'relevance').map(i=>i.id),['1','2']);
assert.equal(itemMatchesStatus({}, 'serie', 'ongoing'), false);
assert.equal(itemMatchesStatus({status:'Returning Series'}, 'serie', 'ongoing'), true);
assert.equal(itemMatchesStatus({status:'Ended'}, 'serie', 'finished'), true);
console.log('Pesquisa: filtros combinados, acentos, favoritos, payloads e ordenação VOD aprovados.');
