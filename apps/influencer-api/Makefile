.PHONY: run worker lint test

run:
	uvicorn apps.influencer-api.main:app --reload --port 8080

worker:
	REDIS_URL=$${REDIS_URL} python apps/influencer-api/worker/rq_worker.py

lint:
	python -m pyflakes apps/influencer-api || true

test:
	pytest -q
