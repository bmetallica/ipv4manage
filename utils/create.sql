CREATE TABLE address_spaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cidr VARCHAR(20) NOT NULL,
    scan VARCHAR(20) NOT NULL,
    tab character varying(10) COLLATE pg_catalog."default" NOT NULL GENERATED ALWAYS AS (('ipvx'::text || id)) STORED
);
