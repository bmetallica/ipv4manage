CREATE TABLE address_spaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cidr VARCHAR(20) NOT NULL,
    scan VARCHAR(20) NOT NULL
);