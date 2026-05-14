.PHONY: help demo install init ingest score cluster angles snapshot pipeline dev build clean

help:
	@echo "Trend Radar - common commands"
	@echo ""
	@echo "  make demo        Fastest path: dashboard with the bundled seed data, no API keys"
	@echo "  make install     Install python + node dependencies"
	@echo "  make init        Initialise SQLite DB (idempotent)"
	@echo "  make ingest      Run every ingestion source (skips sources whose key is unset)"
	@echo "  make score       Score all unscored events with Gemini"
	@echo "  make cluster     Compute cross-source convergence clusters"
	@echo "  make angles      Generate ready-to-record drafts for top opportunities"
	@echo "  make snapshot    Export snapshot.json for the dashboard"
	@echo "  make pipeline    Full run: init -> ingest -> score -> cluster -> angles -> snapshot"
	@echo "  make dev         Start the Next.js dashboard (http://localhost:3000)"
	@echo "  make build       Production build of the Next.js dashboard"
	@echo "  make clean       Remove the local DB + generated snapshot"

# Zero-key instant path. The repo ships a seed snapshot.json, so this shows
# a fully populated dashboard with real data and no setup beyond npm install.
demo:
	cd web && npm install && npm run dev

install:
	pip install -r pipeline/requirements.txt
	cd web && npm install

init:
	python -m pipeline.scripts.init_db

# Each source is prefixed with '-' so a single source failing (or skipping
# itself because its key is unset) never aborts the whole pipeline.
ingest:
	-python -m pipeline.scripts.ingest.rss_feeds
	-python -m pipeline.scripts.ingest.github_releases
	-python -m pipeline.scripts.ingest.github_trending
	-python -m pipeline.scripts.ingest.reddit_tavily
	-python -m pipeline.scripts.ingest.youtube_uploads
	-python -m pipeline.scripts.ingest.youtube_searches
	-python -m pipeline.scripts.ingest.x_apify

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
	@echo "Run 'make dev' to view it."

dev:
	cd web && npm run dev

build:
	cd web && npm run build

clean:
	rm -f data/events.db data/events.db-wal data/events.db-shm
	rm -f web/public/snapshot.json
	@echo "Cleaned local DB and snapshot."
