package cache

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

type CacheDB struct {
	db     *sql.DB
	driver string
}

func NewCacheDB(driver, dataSourceName string) (*CacheDB, error) {
	// Para modernc.org/sqlite, o nome do driver registrado é "sqlite"
	dbDriver := driver
	if driver == "sqlite3" || driver == "sqlite" {
		dbDriver = "sqlite"
	}

	db, err := sql.Open(dbDriver, dataSourceName)
	if err != nil {
		return nil, err
	}

	// Configurações básicas de pool
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	c := &CacheDB{db: db, driver: dbDriver}
	if err := c.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return c, nil
}

func (c *CacheDB) Close() error {
	return c.db.Close()
}

// Driver retorna o driver em uso ("sqlite" ou "postgres").
func (c *CacheDB) Driver() string {
	return c.driver
}

func (c *CacheDB) query(sqlQuery string) string {
	if c.driver != "postgres" {
		return sqlQuery
	}
	// Traduz placeholders de ? para $1, $2, etc., no Postgres
	n := 1
	for strings.Contains(sqlQuery, "?") {
		sqlQuery = strings.Replace(sqlQuery, "?", fmt.Sprintf("$%d", n), 1)
		n++
	}
	return sqlQuery
}

func (c *CacheDB) initSchema() error {
	var err error
	if c.driver == "postgres" {
		_, err = c.db.Exec(`
			CREATE TABLE IF NOT EXISTS api_cache (
				cache_key TEXT PRIMARY KEY,
				status INTEGER NOT NULL,
				content_type TEXT NOT NULL,
				body BYTEA NOT NULL,
				expires_at BIGINT NOT NULL,
				updated_at BIGINT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS media_metadata (
				media_key TEXT PRIMARY KEY,
				media_type TEXT NOT NULL,
				tmdb_id TEXT NOT NULL,
				body BYTEA NOT NULL,
				updated_at BIGINT NOT NULL
			);
		`)
	} else {
		// SQLite (com WAL mode ativado)
		_, _ = c.db.Exec("PRAGMA journal_mode = WAL;")
		_, err = c.db.Exec(`
			CREATE TABLE IF NOT EXISTS api_cache (
				cache_key TEXT PRIMARY KEY,
				status INTEGER NOT NULL,
				content_type TEXT NOT NULL,
				body BLOB NOT NULL,
				expires_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS media_metadata (
				media_key TEXT PRIMARY KEY,
				media_type TEXT NOT NULL,
				tmdb_id TEXT NOT NULL,
				body BLOB NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`)
	}
	return err
}

// ApiCacheGet recupera um registro do cache de API
func (c *CacheDB) ApiCacheGet(cacheKey string) (int, string, []byte, int64, error) {
	queryStr := c.query("SELECT status, content_type, body, expires_at FROM api_cache WHERE cache_key = ?")
	var status int
	var contentType string
	var body []byte
	var expiresAt int64

	err := c.db.QueryRow(queryStr, cacheKey).Scan(&status, &contentType, &body, &expiresAt)
	if err != nil {
		return 0, "", nil, 0, err
	}
	return status, contentType, body, expiresAt, nil
}

// ApiCacheDelete deleta um registro do cache de API
func (c *CacheDB) ApiCacheDelete(cacheKey string) error {
	queryStr := c.query("DELETE FROM api_cache WHERE cache_key = ?")
	_, err := c.db.Exec(queryStr, cacheKey)
	return err
}

// ApiCacheSet salva um registro no cache de API
func (c *CacheDB) ApiCacheSet(cacheKey string, status int, contentType string, body []byte, expiresAt, updatedAt int64) error {
	var queryStr string
	if c.driver == "postgres" {
		queryStr = `
			INSERT INTO api_cache (cache_key, status, content_type, body, expires_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (cache_key) DO UPDATE SET
				status = EXCLUDED.status,
				content_type = EXCLUDED.content_type,
				body = EXCLUDED.body,
				expires_at = EXCLUDED.expires_at,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		queryStr = `
			INSERT INTO api_cache (cache_key, status, content_type, body, expires_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(cache_key) DO UPDATE SET
				status = excluded.status,
				content_type = excluded.content_type,
				body = excluded.body,
				expires_at = excluded.expires_at,
				updated_at = excluded.updated_at
		`
	}
	_, err := c.db.Exec(queryStr, cacheKey, status, contentType, body, expiresAt, updatedAt)
	return err
}

// MediaMetadataGet recupera metadados de mídia
func (c *CacheDB) MediaMetadataGet(mediaKey string) ([]byte, error) {
	queryStr := c.query("SELECT body FROM media_metadata WHERE media_key = ?")
	var body []byte
	err := c.db.QueryRow(queryStr, mediaKey).Scan(&body)
	if err != nil {
		return nil, err
	}
	return body, nil
}

// MediaMetadataSet salva metadados de mídia
func (c *CacheDB) MediaMetadataSet(mediaKey, mediaType, tmdbID string, body []byte, updatedAt int64) error {
	var queryStr string
	if c.driver == "postgres" {
		queryStr = `
			INSERT INTO media_metadata (media_key, media_type, tmdb_id, body, updated_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (media_key) DO UPDATE SET
				media_type = EXCLUDED.media_type,
				tmdb_id = EXCLUDED.tmdb_id,
				body = EXCLUDED.body,
				updated_at = EXCLUDED.updated_at
		`
	} else {
		queryStr = `
			INSERT INTO media_metadata (media_key, media_type, tmdb_id, body, updated_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(media_key) DO UPDATE SET
				media_type = excluded.media_type,
				tmdb_id = excluded.tmdb_id,
				body = excluded.body,
				updated_at = excluded.updated_at
		`
	}
	_, err := c.db.Exec(queryStr, mediaKey, mediaType, tmdbID, body, updatedAt)
	return err
}

// MediaMetadataRow representa uma linha de metadados de mídia.
type MediaMetadataRow struct {
	MediaKey  string
	MediaType string
	TmdbID    string
	Body      []byte
	UpdatedAt int64
}

// MediaMetadataList lista os últimos registros de metadados
func (c *CacheDB) MediaMetadataList(limit int) ([]MediaMetadataRow, error) {
	queryStr := c.query("SELECT media_key, media_type, tmdb_id, body, updated_at FROM media_metadata ORDER BY updated_at DESC LIMIT ?")
	rows, err := c.db.Query(queryStr, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []MediaMetadataRow
	for rows.Next() {
		var r MediaMetadataRow
		if err := rows.Scan(&r.MediaKey, &r.MediaType, &r.TmdbID, &r.Body, &r.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// Counts retorna a quantidade de registros em api_cache e media_metadata.
func (c *CacheDB) Counts() (apiCount int, metaCount int, err error) {
	if err = c.db.QueryRow(c.query("SELECT COUNT(*) FROM api_cache")).Scan(&apiCount); err != nil {
		return 0, 0, err
	}
	if err = c.db.QueryRow(c.query("SELECT COUNT(*) FROM media_metadata")).Scan(&metaCount); err != nil {
		return 0, 0, err
	}
	return apiCount, metaCount, nil
}

// CleanupExpired remove do cache de API os registros já expirados.
func (c *CacheDB) CleanupExpired(now int64) error {
	_, err := c.db.Exec(c.query("DELETE FROM api_cache WHERE expires_at <= ?"), now)
	return err
}

// ClearAll remove todos os registros de cache de API e metadados.
func (c *CacheDB) ClearAll() error {
	if _, err := c.db.Exec(c.query("DELETE FROM api_cache")); err != nil {
		return err
	}
	_, err := c.db.Exec(c.query("DELETE FROM media_metadata"))
	return err
}
