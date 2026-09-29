-- Schéma initial. Horodatages en timestamptz (stockés en UTC).
CREATE TABLE players (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
