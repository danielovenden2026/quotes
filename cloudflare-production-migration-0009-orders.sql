CREATE TABLE orders (
  id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  public_id text NOT NULL,
  order_number text,
  owner text NOT NULL,
  quote_id text NOT NULL,
  quote_number text NOT NULL,
  quote_revision integer NOT NULL,
  customer_email text NOT NULL,
  company text NOT NULL,
  contact text NOT NULL,
  total integer NOT NULL,
  payment_method text NOT NULL,
  payment_status text NOT NULL,
  payment_reference text,
  status text DEFAULT 'New Order' NOT NULL,
  data text NOT NULL,
  created text NOT NULL,
  updated text NOT NULL,
  entered_exo_at text
);
CREATE UNIQUE INDEX orders_public_id_unique ON orders (public_id);
CREATE UNIQUE INDEX orders_quote_revision_unique ON orders (quote_id, quote_revision);
CREATE UNIQUE INDEX orders_order_number_unique ON orders (order_number);
CREATE INDEX idx_orders_owner_created ON orders (owner, created);
CREATE INDEX idx_orders_customer_email_created ON orders (customer_email, created);
