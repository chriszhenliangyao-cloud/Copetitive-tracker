"use client";

import { useMemo, useState } from "react";
import Thumb from "@/components/Thumb";
import Sparkline from "@/components/Sparkline";
import { COUNTRY_NAMES, fmtEUR, fmtMoney, titleCase } from "@/lib/format";

export type PriceRow = {
  retailer: string;
  country: string | null;
  code: string | null;
  byDate: Record<string, number | null>;
};

export type IniuProduct = {
  id: number;
  sku: string;
  name: string;
  capacity: string | null;
  size: string | null;
  weight: string | null;
  wired_power: string | null;
  wireless_power: string | null;
  usb_ports: string | null;
  magsafe: boolean | null;
  image_url: string | null;
};

export type Competitor = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  capacity: string | null;
  wired_power: string | null;
  wireless_power: string | null;
  size: string | null;
  weight: string | null;
  usb_ports: string | null;
  magsafe: boolean;
  image_url: string | null;
  rrp: number | null;
  rrp_currency: string | null;
  priceRows: PriceRow[];
  dates: string[];
};

export default function IniuTable({
  products,
  compByIniu,
}: {
  products: IniuProduct[];
  compByIniu: Record<number, Competitor[]>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const totalLinks = useMemo(
    () => Object.values(compByIniu).reduce((n, arr) => n + arr.length, 0),
    [compByIniu],
  );

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products;
    return products.filter((p) =>
      `${p.sku} ${p.name} ${p.capacity ?? ""} ${p.wired_power ?? ""} ${p.usb_ports ?? ""} ${p.magsafe ? "magsafe" : ""}`
        .toLowerCase()
        .includes(qq),
    );
  }, [products, q]);

  const magsafeCount = products.filter((p) => p.magsafe).length;
  const mappedCount = products.filter((p) => (compByIniu[p.id]?.length ?? 0) > 0).length;

  const selectedProduct = selected != null ? products.find((p) => p.id === selected) ?? null : null;
  if (selectedProduct) {
    return (
      <Compare
        product={selectedProduct}
        competitors={compByIniu[selectedProduct.id] ?? []}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>INIU Products</h1>
          <p>INIU&apos;s catalogue with mapped competitors. Click a product for the comparison.</p>
        </div>
        <div className="pill">{products.length} products</div>
      </header>

      <section className="metrics">
        <Metric label="Products" value={products.length} />
        <Metric label="MagSafe" value={magsafeCount} />
        <Metric label="With competitors" value={mappedCount} />
        <Metric label="Competitor links" value={totalLinks} />
      </section>

      {totalLinks === 0 ? (
        <div className="note">
          No competitor links yet. Run <code>cloud/pipeline/upload_iniu.py --write</code> to migrate the INIU
          spreadsheet&apos;s &ldquo;Competitive SKU&rdquo; columns — then each product shows its side-by-side comparison here.
        </div>
      ) : null}

      <div className="filter-bar">
        <div className="filter-group" style={{ flex: 1 }}>
          <label>Search</label>
          <input
            className="search"
            type="search"
            placeholder="SKU, name, capacity, power…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <section className="table-panel">
        <div className="table-head">
          <h2>Catalogue</h2>
          <span className="count">
            {filtered.length} of {products.length}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Capacity</th>
                <th>Wired</th>
                <th>Wireless</th>
                <th>Ports</th>
                <th>MagSafe</th>
                <th>Competitors</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const n = compByIniu[p.id]?.length ?? 0;
                return (
                  <tr key={p.id} className={n > 0 ? "clickable" : ""} onClick={() => n > 0 && setSelected(p.id)}>
                    <td>
                      <Thumb src={p.image_url} alt={p.name} />
                    </td>
                    <td>
                      {p.name}
                      <div className="sub">{p.sku}</div>
                    </td>
                    <td>{p.capacity ?? "—"}</td>
                    <td>{p.wired_power ?? "—"}</td>
                    <td>{p.wireless_power ?? "—"}</td>
                    <td>{p.usb_ports ?? "—"}</td>
                    <td>{p.magsafe ? <span className="badge badge-magsafe">MagSafe</span> : "—"}</td>
                    <td>
                      {n > 0 ? <span className="badge badge-mapped">{n}</span> : <span className="muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Compare({
  product,
  competitors,
  onBack,
}: {
  product: IniuProduct;
  competitors: Competitor[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"general" | "price">("general");
  const [brand, setBrand] = useState("");
  const [retailer, setRetailer] = useState("");
  const [country, setCountry] = useState("");

  const opts = useMemo(() => {
    const brands = new Set<string>();
    const retailers = new Set<string>();
    const countries = new Set<string>();
    for (const c of competitors) {
      brands.add(c.brand);
      for (const r of c.priceRows) {
        retailers.add(r.retailer);
        if (r.country) countries.add(r.country);
      }
    }
    return {
      brands: [...brands].sort(),
      retailers: [...retailers].sort(),
      countries: [...countries].sort(),
    };
  }, [competitors]);

  const shown = useMemo(() => {
    return competitors.filter((c) => {
      if (brand && c.brand !== brand) return false;
      if (retailer && !c.priceRows.some((r) => r.retailer === retailer)) return false;
      if (country && !c.priceRows.some((r) => r.country === country)) return false;
      return true;
    });
  }, [competitors, brand, retailer, country]);

  return (
    <>
      <header className="page-head">
        <div>
          <button className="btn" onClick={onBack} style={{ marginBottom: 12 }}>
            ← Back
          </button>
          <h1>{product.name}</h1>
          <p>
            {product.sku}
            {product.capacity ? ` · ${product.capacity}` : ""}
            {product.wired_power ? ` · ${product.wired_power}` : ""}
            {product.magsafe ? " · MagSafe" : ""}
          </p>
        </div>
        <Thumb src={product.image_url} alt={product.name} large />
      </header>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`btn${tab === "general" ? " btn-primary" : ""}`} onClick={() => setTab("general")}>
            General Info
          </button>
          <button className={`btn${tab === "price" ? " btn-primary" : ""}`} onClick={() => setTab("price")}>
            Price
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Sel label="Brand" value={brand} set={setBrand} opts={opts.brands} render={titleCase} />
          <Sel label="Retailer" value={retailer} set={setRetailer} opts={opts.retailers} />
          <Sel label="Country" value={country} set={setCountry} opts={opts.countries} render={(c) => COUNTRY_NAMES[c] ?? c} />
        </div>
      </div>

      <section className="table-panel">
        <div className="table-head">
          <h2>{tab === "general" ? "Competitive specs" : "Competitive pricing"}</h2>
          <span className="count">
            {shown.length} of {competitors.length}
          </span>
        </div>
        <div className="table-wrap">
          {tab === "general" ? <GeneralTable competitors={shown} /> : <PriceTable competitors={shown} retailer={retailer} country={country} />}
        </div>
      </section>
    </>
  );
}

function GeneralTable({ competitors }: { competitors: Competitor[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Brand</th>
          <th>Product</th>
          <th>Capacity</th>
          <th>Wired</th>
          <th>Wireless</th>
          <th>Size</th>
          <th>Weight</th>
          <th>Ports</th>
          <th>MagSafe</th>
          <th>RRP</th>
        </tr>
      </thead>
      <tbody>
        {competitors.map((c) => (
          <tr key={c.id}>
            <td>
              <Thumb src={c.image_url} alt={c.name} />
            </td>
            <td>{titleCase(c.brand)}</td>
            <td>
              {c.name}
              <div className="sub">{c.sku}</div>
            </td>
            <td>{c.capacity ?? "—"}</td>
            <td>{c.wired_power ?? "—"}</td>
            <td>{c.wireless_power ?? "—"}</td>
            <td>{c.size ?? "—"}</td>
            <td>{c.weight ?? "—"}</td>
            <td>{c.usb_ports ?? "—"}</td>
            <td>{c.magsafe ? <span className="badge badge-magsafe">Yes</span> : "—"}</td>
            <td>{c.rrp != null ? fmtMoney(c.rrp, c.rrp_currency) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PriceTable({
  competitors,
  retailer,
  country,
}: {
  competitors: Competitor[];
  retailer: string;
  country: string;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Brand</th>
          <th>Product</th>
          <th>RRP</th>
          <th>Retailer</th>
          <th>Price history (EUR)</th>
          <th>Trend</th>
        </tr>
      </thead>
      <tbody>
        {competitors.map((c) => {
          const dates = c.dates.slice(-4);
          const rows = c.priceRows.filter(
            (r) => (!retailer || r.retailer === retailer) && (!country || r.country === country),
          );
          if (rows.length === 0) {
            return (
              <tr key={c.id}>
                <td>
                  <Thumb src={c.image_url} alt={c.name} />
                </td>
                <td>{titleCase(c.brand)}</td>
                <td>
                  {c.name}
                  <div className="sub">{c.sku}</div>
                </td>
                <td>{c.rrp != null ? fmtMoney(c.rrp, c.rrp_currency) : "—"}</td>
                <td className="muted" colSpan={3}>
                  no channel listing
                </td>
              </tr>
            );
          }
          return rows.map((r, i) => (
            <tr key={`${c.id}-${r.retailer}-${i}`}>
              {i === 0 ? (
                <>
                  <td rowSpan={rows.length}>
                    <Thumb src={c.image_url} alt={c.name} />
                  </td>
                  <td rowSpan={rows.length}>{titleCase(c.brand)}</td>
                  <td rowSpan={rows.length}>
                    {c.name}
                    <div className="sub">{c.sku}</div>
                  </td>
                  <td rowSpan={rows.length}>{c.rrp != null ? fmtMoney(c.rrp, c.rrp_currency) : "—"}</td>
                </>
              ) : null}
              <td>
                {r.retailer}
                {r.country ? <span className="muted"> ({r.country})</span> : null}
              </td>
              <td>
                <div style={{ display: "flex", gap: 10 }}>
                  {dates.map((d, di) => {
                    const v = r.byDate[d] ?? null;
                    const prev = di > 0 ? r.byDate[dates[di - 1]] ?? null : null;
                    let cls = "";
                    if (v != null && prev != null && v !== prev) cls = v > prev ? "chg-up" : "chg-down";
                    return (
                      <div key={d} style={{ textAlign: "right", minWidth: 52 }}>
                        <div style={{ fontSize: 10, color: "#9aa6ae" }}>{d.slice(5)}</div>
                        <div className={cls}>{v != null ? fmtEUR(v) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </td>
              <td>
                <Sparkline values={dates.map((d) => r.byDate[d] ?? null)} />
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function Sel({
  label,
  value,
  set,
  opts,
  render,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  opts: string[];
  render?: (v: string) => string;
}) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">All</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {render ? render(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}
