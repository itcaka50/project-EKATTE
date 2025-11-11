CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS regions (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS region_name_trgm_idx ON regions USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS municipalities (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region_code TEXT NOT NULL REFERENCES regions(code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS municipalities_name_trgm_idx on municipalities USING gin (name gin_trgm_ops);


CREATE TABLE IF NOT EXISTS town_halls (
    code TEXT PRIMARY KEY,
    NAME TEXT NOT NULL,
    municipality_code TEXT NOT NULL REFERENCES municipalities(code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS town_halls_name_trgm_idx on town_halls USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS territorial-units (
    ekatte TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    town_hall_code TEXT REFERENCES town_halls(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    municipality_code TEXT NOT NULL REFERENCES municipalities(code) ON UPDATE CASCDADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS territorial-units_name_trgm_idx ON territorial-units USING gin (name gin_trgm_ops);