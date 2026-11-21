# Schema diff tool for scripts/db-local.sh diff. Pinned: migra is unmaintained and needs old SQLAlchemy/setuptools.
FROM python:3.12-slim
RUN pip install --no-cache-dir "setuptools<81" "sqlalchemy<2" migra==3.0.1663481299 psycopg2-binary
ENTRYPOINT ["migra"]
