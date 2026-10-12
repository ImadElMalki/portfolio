CREATE TABLE rate_limit_counters (
  scope TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope, bucket_start)
) WITHOUT ROWID;

CREATE INDEX rate_limit_counters_by_expiry
  ON rate_limit_counters (expires_at);
