-- POLICYLAB database bootstrap — mounted read-only at /docker-entrypoint-initdb.d
-- (docker-compose.yml → db service, first start only, empty volume).
--
-- contracts §9.3: postgis/postgis:16-3.4 image; NO pgvector (image lacks it).
-- Required before `alembic upgrade head` / app startup creates city_features.geom.

CREATE EXTENSION IF NOT EXISTS postgis;
