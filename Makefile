.PHONY: help install init ingest score cluster angles snapshot pipeline dev build clean

help:
	@echo "Trend Radar - common commands"
	@echo ""
	@echo "  make install     Install python + node dependencies"
	@echo "  make init        Initialise SQLite DB (idempotent)"
	@echo "  make ingest      Run all ingestion sources (github, rss, reddit, youtube)"
	@echo "  make score       Score all unscored events with Gemini Flash-Lite"
	@echo "  make cluster     Compute cross-source convergence clusters"
	@echo "  make angles      Generate ready-to-record drafts for top opportunities"
	@echo "  make snapshot    Export snapshot.json for the dashboard"
	@echo "  make pipeline    Full pipeline run: ingest -> score -> cluster -> snapshot"
	@echo "  make dev         Start the Next.js dashboard locally (http://localhost:3000)"
	@echo "  make build       Production build of the Next.js dashboard"

install:
	pip install -r pipeline/requirements.txt
	cd web && npm install

init:
	python -m pipeline.scripts.init_db

ingest:
	python -m pipeline.scripts.ingest.rss_feeds
	python -m pipeline.scripts.ingest.github_releases
	python -m pipeline.scripts.ingest.github_trending
	python -m pipeline.scripts.ingest.reddit_tavily
	python -m pipeline.scripts.ingest.youtube_uploads
	python -m pipeline.scripts.ingest.youtube_searches
	@echo "(x_apify skipped - requires APIFY_TOKEN. Run python -m pipeline.scripts.ingest.x_apify when ready)"

score:
	python -m pipeline.scripts.score

cluster:
	python -m pipeline.scripts.cluster

angles:
	python -m pipeline.scripts.generate_angles

snapshot:
	python -m pipeline.scripts.export_snapshot

pipeline: init ingest score cluster angles snapshot
	@echo ""
	@echo "Full pipeline complete. Snapshot at web/public/snapshot.json"

dev:
	cd web && npm run dev

build:
	cd web && npm run build

clean:
	rm -f data/events.db data/events.db-wal data/events.db-shm
	rm -f web/public/snapshot.json
	@echo "Cleaned local DB and snapshot."
