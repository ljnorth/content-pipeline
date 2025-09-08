import os
import time
import redis
from rq import Worker, Queue, Connection

redis_url = os.getenv('REDIS_URL')
if not redis_url:
    raise SystemExit('REDIS_URL is required')

conn = redis.from_url(redis_url)
listen = ['default']

if __name__ == '__main__':
    with Connection(conn):
        worker = Worker(list(map(Queue, listen)))
        worker.work(with_scheduler=True)
