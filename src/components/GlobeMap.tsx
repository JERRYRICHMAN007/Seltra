import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import * as d3 from "d3";
import { ListPagination } from "@/components/list-pagination";
import { useClientPagination } from "@/hooks/use-client-pagination";

export type GlobePoint = {
  lat: number;
  lng: number;
  label?: string;
  count?: number;
  country?: string;
};

export type FootprintCountryInput = {
  country: string;
  count: number;
  cities: Array<{ city: string; count: number }>;
};

type CountrySelection = {
  name: string;
  count: number;
  places: Array<{ label: string; count: number }>;
};

type GlobeMapProps = {
  points?: GlobePoint[];
  /** Canonical country → cities from footprint API (drives the places box). */
  countriesFootprint?: FootprintCountryInput[];
  /** When set (e.g. from a country chip click), open that country's places box. */
  focusCountry?: string | null;
  onFocusCountryChange?: (country: string | null) => void;
};

const COUNTRIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson";

const MAP_VIEWBOX = { width: 1000, height: 500 };
const MAP_BASE_SCALE = 165;
const MAP_DEFAULT_ZOOM = 1.75;
const MAP_DEFAULT_CENTER: [number, number] = [8, 8];
const MAP_MIN_ZOOM = 1.2;
const MAP_MAX_ZOOM = 3.5;

function getCountryName(d: { properties?: { NAME?: string; ADMIN?: string } }) {
  return d.properties?.NAME || d.properties?.ADMIN || "";
}

function buildSelection(
  name: string,
  countriesFootprint: FootprintCountryInput[],
  points: GlobePoint[],
  pointCounts: Record<string, number>,
): CountrySelection | null {
  const entry = countriesFootprint.find((c) => c.country === name);
  if (entry) {
    const places =
      entry.cities.length > 0
        ? entry.cities.map((city) => ({
            label: `${city.city}, ${entry.country}`,
            count: city.count,
          }))
        : [{ label: entry.country, count: entry.count }];
    const placeSum = places.reduce((sum, p) => sum + p.count, 0);
    return {
      name: entry.country,
      count: placeSum || entry.count,
      places,
    };
  }

  const fromPoints = points.filter((p) => p.country === name);
  if (!fromPoints.length && !pointCounts[name]) return null;

  return {
    name,
    count: pointCounts[name] || fromPoints.reduce((s, p) => s + (p.count ?? 1), 0),
    places: fromPoints.map((p) => ({
      label: p.label ?? name,
      count: p.count ?? 1,
    })),
  };
}

function CountryPlacesPanel({
  selection,
  onClose,
}: {
  selection: CountrySelection;
  onClose: () => void;
}) {
  const {
    page,
    setPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
  } = useClientPagination(selection.places, {
    pageSize: 6,
    resetDeps: [selection.name, selection.places.length],
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        left: "16px",
        background: "rgba(10,15,30,0.92)",
        border: "1px solid rgba(29,158,117,0.4)",
        borderRadius: "12px",
        padding: "14px 18px",
        color: "white",
        fontFamily: "Inter, sans-serif",
        minWidth: "220px",
        maxWidth: "300px",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontWeight: 600, fontSize: "14px" }}>{selection.name}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "16px" }}
        >
          ×
        </button>
      </div>
      <div style={{ fontSize: "12px", color: "#1D9E75", marginBottom: "8px" }}>
        {selection.count} merchant{selection.count === 1 ? "" : "s"} ·{" "}
        {selection.places.length} place{selection.places.length === 1 ? "" : "s"}
      </div>
      <div>
        {pageItems.map((place, i) => (
          <div
            key={`${place.label}-${i}`}
            style={{
              fontSize: "12px",
              padding: "6px 0",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.8)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{place.label}</span>
            <span style={{ color: "#1D9E75", fontFamily: "monospace", flexShrink: 0 }}>{place.count}</span>
          </div>
        ))}
      </div>
      <ListPagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={setPage}
        itemLabel="places"
        compact
        tone="dark"
        className="pt-3 mt-1 flex-col gap-2 sm:flex-col sm:items-stretch"
      />
    </div>
  );
}

export default function GlobeMap({
  points = [],
  countriesFootprint = [],
  focusCountry = null,
  onFocusCountryChange,
}: GlobeMapProps) {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [dimensions, setDimensions] = useState({ width: 600, height: 420 });
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [mapZoomScale, setMapZoomScale] = useState(MAP_DEFAULT_ZOOM);
  const [mapCenter, setMapCenter] = useState<[number, number]>(MAP_DEFAULT_CENTER);
  const [isMapView, setIsMapView] = useState(false);
  const [hoveredMapCountry, setHoveredMapCountry] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountrySelection | null>(null);

  useEffect(() => {
    fetch(COUNTRIES_GEOJSON_URL)
      .then((r) => r.json())
      .then((data) => setCountries(data.features));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      const safeWidth = Math.max(width, 320);
      setDimensions({ width: safeWidth, height: Math.min(safeWidth * 0.55, 420) });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isMapView) return;

    const timer = setTimeout(() => {
      if (!globeRef.current) return;
      const controls = globeRef.current.controls();
      if (!controls) return;
      controls.enableZoom = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 2.0 }, 0);
    }, 500);

    return () => clearTimeout(timer);
  }, [isMapView, dimensions.width, countries.length]);

  const merchantsByCountry = useMemo(() => {
    const fromFootprint = Object.fromEntries(
      countriesFootprint.map((c) => {
        const citySum = c.cities.reduce((s, city) => s + city.count, 0);
        return [c.country, citySum || c.count];
      }),
    ) as Record<string, number>;

    if (Object.keys(fromFootprint).length) return fromFootprint;

    return points.reduce(
      (acc, p) => {
        if (p.country) acc[p.country] = (acc[p.country] || 0) + (p.count ?? 1);
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [countriesFootprint, points]);

  const openCountry = useCallback(
    (name: string) => {
      const selection = buildSelection(name, countriesFootprint, points, merchantsByCountry);
      if (!selection) return;
      setSelectedCountry(selection);
      onFocusCountryChange?.(name);

      const anchor = points.find((p) => p.country === name);
      if (!isMapView && globeRef.current && anchor) {
        globeRef.current.pointOfView({ lat: anchor.lat, lng: anchor.lng, altitude: 1.5 }, 800);
      }
    },
    [countriesFootprint, points, merchantsByCountry, onFocusCountryChange, isMapView],
  );

  const closeCountry = useCallback(() => {
    setSelectedCountry(null);
    onFocusCountryChange?.(null);
    if (isMapView) {
      setMapZoomScale(MAP_DEFAULT_ZOOM);
      setMapCenter(MAP_DEFAULT_CENTER);
    } else {
      setZoomLevel(2.0);
      globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.0 }, 800);
    }
  }, [isMapView, onFocusCountryChange]);

  // Country chips (or parent) request opening a country box
  useEffect(() => {
    if (!focusCountry) {
      setSelectedCountry(null);
      return;
    }
    openCountry(focusCountry);
  }, [focusCountry]); // eslint-disable-line react-hooks/exhaustive-deps -- open on external focus only

  useEffect(() => {
    if (!isMapView) setHoveredMapCountry(null);
  }, [isMapView]);

  const mapProjection = useMemo(
    () =>
      d3
        .geoNaturalEarth1()
        .scale(MAP_BASE_SCALE * mapZoomScale)
        .center(mapCenter)
        .translate([MAP_VIEWBOX.width / 2, MAP_VIEWBOX.height / 2]),
    [mapZoomScale, mapCenter],
  );

  const getCountryScreenPos = useCallback(
    (countryName: string) => {
      const feature = countries.find((f) => getCountryName(f) === countryName);
      if (!feature) return null;
      const projected = mapProjection(d3.geoCentroid(feature));
      if (!projected) return null;
      const [x, y] = projected;
      return {
        x: (x / MAP_VIEWBOX.width) * 100,
        y: (y / MAP_VIEWBOX.height) * 100,
      };
    },
    [countries, mapProjection],
  );

  useEffect(() => {
    if (!isMapView || !svgRef.current || countries.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const path = d3.geoPath().projection(mapProjection);
    svg
      .selectAll("path")
      .data(countries)
      .join("path")
      .attr("d", path as any)
      .attr("fill", (d: any) => {
        const name = getCountryName(d);
        const count = merchantsByCountry[name] || 0;
        if (count === 0) return "rgba(255,255,255,0.06)";
        if (count === 1) return "rgba(29,158,117,0.5)";
        if (count <= 3) return "rgba(29,158,117,0.75)";
        return "rgba(29,158,117,1.0)";
      })
      .attr("stroke", "rgba(255,255,255,0.08)")
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d: any) => {
        const name = getCountryName(d);
        if (merchantsByCountry[name]) setHoveredMapCountry(name);
      })
      .on("mouseleave", () => setHoveredMapCountry(null))
      .on("click", (_event, d: any) => {
        const name = getCountryName(d);
        const centroid = d3.geoCentroid(d) as [number, number];
        setMapCenter(centroid);
        setMapZoomScale((s) => Math.min(s + 0.45, MAP_MAX_ZOOM));
        if (!merchantsByCountry[name]) return;
        openCountry(name);
      });
  }, [isMapView, countries, merchantsByCountry, mapProjection, openCountry]);

  const zoomIn = () => {
    if (isMapView) {
      setMapZoomScale((s) => Math.min(s + 0.25, MAP_MAX_ZOOM));
      return;
    }
    const next = Math.max(zoomLevel - 0.4, 0.8);
    setZoomLevel(next);
    globeRef.current?.pointOfView({ altitude: next }, 400);
  };

  const zoomOut = () => {
    if (isMapView) {
      setMapZoomScale((s) => Math.max(s - 0.25, MAP_MIN_ZOOM));
      return;
    }
    const next = Math.min(zoomLevel + 0.4, 3.5);
    setZoomLevel(next);
    globeRef.current?.pointOfView({ altitude: next }, 400);
  };

  return (
    <div className="relative" style={{ position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        <button
          type="button"
          onClick={() => setIsMapView((v) => !v)}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 20,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            padding: "5px 12px",
            color: "white",
            fontSize: 12,
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isMapView ? "🌐 Globe" : "🗺️ Map"}
        </button>

        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={zoomIn}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={zoomOut}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(4px)",
            }}
          >
            −
          </button>
        </div>

        {isMapView ? (
          <div style={{ width: "100%", height: dimensions.height, position: "relative", overflow: "hidden" }}>
            <svg
              viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
              style={{ width: "100%", height: "100%" }}
              ref={svgRef}
            />
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {Object.entries(merchantsByCountry).map(([country, count]) => {
                if (hoveredMapCountry !== country) return null;
                const coords = getCountryScreenPos(country);
                if (!coords) return null;
                return (
                  <div
                    key={country}
                    style={{
                      position: "absolute",
                      left: `${coords.x}%`,
                      top: `${coords.y}%`,
                      transform: "translate(-50%,-50%)",
                      background: "rgba(29,158,117,0.85)",
                      borderRadius: 20,
                      padding: "3px 10px",
                      fontSize: 11,
                      color: "white",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {country} · {count}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            enablePointerInteraction={true}
            zooming={false}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            showAtmosphere
            atmosphereColor="#1D9E75"
            atmosphereAltitude={0.12}
            hexBinPointsData={points}
            hexBinPointLat="lat"
            hexBinPointLng="lng"
            hexBinPointWeight="count"
            hexBinResolution={3}
            hexMargin={0.18}
            hexAltitude={0.004}
            hexTopColor={() => "rgba(255,255,255,0.75)"}
            hexSideColor={() => "rgba(255,255,255,0.2)"}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointColor={() => "#1D9E75"}
            pointAltitude={0.025}
            pointRadius={0.35}
            pointLabel={(d: GlobePoint) =>
              d.label
                ? `<div style="font-family:Inter,sans-serif;font-size:12px">${d.label}<br/><span style="color:#1D9E75">${d.count} merchant${(d.count ?? 0) > 1 ? "s" : ""}</span></div>`
                : ""
            }
            polygonsData={countries}
            polygonAltitude={(d: any) => {
              const name = d.properties?.NAME || d.properties?.ADMIN;
              const count = merchantsByCountry[name] || 0;
              if (count === 0) return 0.001;
              if (count === 1) return 0.03;
              if (count <= 3) return 0.06;
              return 0.1;
            }}
            polygonCapColor={(d: any) => {
              const name = d.properties?.NAME || d.properties?.ADMIN;
              const count = merchantsByCountry[name] || 0;
              if (count === 0) return "rgba(255,255,255,0.04)";
              if (count === 1) return "rgba(29,158,117,0.6)";
              if (count <= 3) return "rgba(29,158,117,0.8)";
              return "rgba(29,158,117,1.0)";
            }}
            polygonSideColor={() => "rgba(0,0,0,0)"}
            polygonStrokeColor={(d: any) => {
              const name = d.properties?.NAME || d.properties?.ADMIN;
              return merchantsByCountry[name] ? "rgba(29,158,117,0.9)" : "rgba(255,255,255,0.03)";
            }}
            polygonLabel={(d: any) => {
              const name = d.properties?.NAME || d.properties?.ADMIN;
              const count = merchantsByCountry[name] || 0;
              if (count === 0) return "";
              return `<div style="background:rgba(10,15,30,0.9);color:white;padding:10px 14px;border-radius:10px;font-size:13px;font-family:Inter,sans-serif;border:1px solid rgba(29,158,117,0.4)">
    <div style="font-weight:600;margin-bottom:4px">${name}</div>
    <div style="color:#1D9E75">${count} merchant${count > 1 ? "s" : ""}</div>
  </div>`;
            }}
            onPolygonClick={(d: any) => {
              const name = d.properties?.NAME || d.properties?.ADMIN;
              if (!merchantsByCountry[name]) return;
              openCountry(name);
            }}
          />
        )}
      </div>

      {selectedCountry && (
        <CountryPlacesPanel selection={selectedCountry} onClose={closeCountry} />
      )}
    </div>
  );
}
