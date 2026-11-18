import { DatabaseSync } from "node:sqlite";
import { inventory } from "../src/dcim/model.ts";
const db = new DatabaseSync(process.argv[2] ?? "campus.sqlite");
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS hall(id INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS equipment_row(id TEXT PRIMARY KEY,hall_id INTEGER NOT NULL REFERENCES hall);
CREATE TABLE IF NOT EXISTS zone(id TEXT PRIMARY KEY,hall_id INTEGER NOT NULL REFERENCES hall);
CREATE TABLE IF NOT EXISTS network_switch(id TEXT PRIMARY KEY,row_id TEXT NOT NULL REFERENCES equipment_row);
CREATE TABLE IF NOT EXISTS rack(id TEXT PRIMARY KEY,row_id TEXT NOT NULL REFERENCES equipment_row,zone_id TEXT NOT NULL REFERENCES zone,switch_id TEXT NOT NULL REFERENCES network_switch,x REAL,z REAL,ru INTEGER,allocation_kw REAL);
CREATE TABLE IF NOT EXISTS device(id TEXT PRIMARY KEY,rack_id TEXT NOT NULL REFERENCES rack,start_u INTEGER,size_u INTEGER,category TEXT,allocation_kw REAL);
CREATE TABLE IF NOT EXISTS feed(id TEXT PRIMARY KEY,rack_id TEXT NOT NULL REFERENCES rack,side TEXT CHECK(side IN ('A','B')),rating_kw REAL);
BEGIN;`);
const tables = {
  hall: 1,
  equipment_row: 2,
  zone: 2,
  network_switch: 2,
  rack: 8,
  device: 6,
  feed: 4,
};
const sql = Object.fromEntries(
  Object.entries(tables).map(([table, n]) => [
    table,
    db.prepare(
      "INSERT OR IGNORE INTO " +
        table +
        " VALUES (" +
        Array(n).fill("?").join(",") +
        ")",
    ),
  ]),
);
try {
  for (const r of inventory()) {
    const row = r.id.slice(0, r.id.lastIndexOf("-"));
    sql.hall.run(r.hall + 1);
    sql.equipment_row.run(row, r.hall + 1);
    sql.zone.run(r.zone, r.hall + 1);
    sql.network_switch.run(r.switchId, row);
    sql.rack.run(r.id, row, r.zone, r.switchId, r.x, r.z, r.ru, r.allocation);
    for (const d of r.devices)
      sql.device.run(d.id, r.id, d.start, d.u, d.type, d.allocation);
    for (const side of ["A", "B"])
      sql.feed.run(r.id + "-" + side, r.id, side, 12);
  }
  db.exec("COMMIT");
  console.log(
    db
      .prepare(
        "SELECT COUNT(*) AS racks,SUM(allocation_kw) AS design_kW FROM rack",
      )
      .get(),
  );
} finally {
  db.close();
}
