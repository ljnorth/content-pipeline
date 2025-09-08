.PHONY: run worker lint test

run:
	uvicorn apps.influencer_api.main:app --reload --port 8080

worker:
	REDIS_URL=$${REDIS_URL} python apps/influencer_api/worker/rq_worker.py

lint:
	python -m pyflakes apps/influencer_api || true

test:
	pytest -q
