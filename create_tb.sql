-- Create database, roles

CREATE ROLE situations_admin LOGIN
  NOSUPERUSER INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;

alter user situations_admin PASSWORD 'ekevbb123';

create database situationsdb;

\c situationsdb

create SEQUENCE situations_id_seq;

create table situations
(
	id serial not null
		constraint situations_pkey
			primary key,
  fio character(255),
  "text" text,
  phone character(50),
  "timestamp" character(20),
  voice character(100),
  photo character(100),
  user_id character(30)
)
;

ALTER TABLE situations ALTER COLUMN id SET DEFAULT nextval('situations_id_seq'::regclass);

ALTER TABLE situations OWNER TO situations_admin;
alter sequence situations_id_seq owner to situations_admin