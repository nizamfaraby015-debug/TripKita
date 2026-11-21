import { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Clock, LocateFixed, MapPin, Navigation } from 'lucide-react';
import {
  LatLngLiteral,
  RouteMetrics,
  formatDistanceKm,
  formatDurationId,
  isQuotaExceededError,
} from '../types/booking';

interface RouteMapPanelProps {
  pickupCoord: LatLngLiteral | null;
  destinationCoord: LatLngLiteral | null;
  pickupLabel: string;
  destinationLabel: string;
  routeMetrics: RouteMetrics | null;
  onRouteComputed: (metrics: RouteMetrics | null) => void;
  onUseCurrentLocation: (coord: LatLngLiteral) => void;
}

const DEFAULT_INDONESIA_CENTER: LatLngLiteral = {
  lat: -6.2088,
  lng: 106.8456,
};

function RoutePolylineController({
  pickupCoord,
  destinationCoord,
  onRouteComputed,
  onErrorChange,
  onLoadingChange,
}: {
  pickupCoord: LatLngLiteral | null;
  destinationCoord: LatLngLiteral | null;
  onRouteComputed: (metrics: RouteMetrics | null) => void;
  onErrorChange: (msg: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    // Cleanup previous polylines on change
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map) return;

    if (pickupCoord && !destinationCoord) {
      map.panTo(pickupCoord);
      map.setZoom(14);
      onRouteComputed(null);
      onErrorChange(null);
      return;
    }

    if (!pickupCoord && destinationCoord) {
      map.panTo(destinationCoord);
      map.setZoom(14);
      onRouteComputed(null);
      onErrorChange(null);
      return;
    }

    if (!routesLib || !pickupCoord || !destinationCoord) {
      onRouteComputed(null);
      onErrorChange(null);
      return;
    }

    let cancelled = false;
    onLoadingChange(true);
    onErrorChange(null);

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin: pickupCoord,
      destination: destinationCoord,
      travelMode: routesLib.TravelMode.DRIVING,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    routesLib.Route.computeRoutes(request)
      .then((response) => {
        if (cancelled) return;
        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null);
          onErrorChange('Rute kendaraan tidak ditemukan untuk titik tersebut.');
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#00A84B',
            strokeWeight: 6,
            strokeOpacity: 0.92,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, {
            top: 48,
            right: 48,
            bottom: 84,
            left: 48,
          });
        }

        onRouteComputed({
          distanceMeters: primaryRoute.distanceMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        onRouteComputed(null);
        if (isQuotaExceededError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onErrorChange('Tidak dapat menghitung rute saat ini. Tetap bisa lanjut booking via WhatsApp.');
      })
      .finally(() => {
        if (!cancelled) {
          onLoadingChange(false);
        }
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, pickupCoord, destinationCoord, onRouteComputed, onErrorChange, onLoadingChange]);

  return null;
}

export function RouteMapPanel({
  pickupCoord,
  destinationCoord,
  pickupLabel,
  destinationLabel,
  routeMetrics,
  onRouteComputed,
  onUseCurrentLocation,
}: RouteMapPanelProps) {
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoError('Browser tidak mendukung deteksi lokasi.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        onUseCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setGeoLoading(false);
        setGeoError('Izin lokasi belum aktif. Silakan ketik alamat penjemputan.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="relative w-full h-[300px] sm:h-[360px] lg:h-full lg:min-h-[500px] rounded-2xl overflow-hidden border border-emerald-950/15 bg-forest-50">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={DEFAULT_INDONESIA_CENTER}
        defaultZoom={11}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        {pickupCoord && (
          <AdvancedMarker
            position={pickupCoord}
            title={pickupLabel || 'Titik Penjemputan'}
          >
            <Pin
              background="#008F40"
              borderColor="#063B27"
              glyphColor="#FFFFFF"
              glyph="A"
            />
          </AdvancedMarker>
        )}

        {destinationCoord && (
          <AdvancedMarker
            position={destinationCoord}
            title={destinationLabel || 'Tujuan Perjalanan'}
          >
            <Pin
              background="#063B27"
              borderColor="#F5B041"
              glyphColor="#F5B041"
              glyph="B"
            />
          </AdvancedMarker>
        )}

        <RoutePolylineController
          pickupCoord={pickupCoord}
          destinationCoord={destinationCoord}
          onRouteComputed={onRouteComputed}
          onErrorChange={setRouteError}
          onLoadingChange={setRouteLoading}
        />
      </GoogleMap>

      {/* Top-right GPS quick-locate button */}
      <div className="absolute top-3 right-3 z-10">
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={geoLoading}
          className="min-h-[40px] px-3 py-2 rounded-xl bg-white/95 hover:bg-white border border-slate-200 text-forest-900 font-display font-semibold text-xs shadow-md inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
        >
          <LocateFixed className="w-3.5 h-3.5 text-grab-600 shrink-0" aria-hidden="true" />
          <span>{geoLoading ? 'Mencari...' : 'Lokasi Saya'}</span>
        </button>
      </div>

      {/* Bottom Route Summary Card — Distance & Duration ONLY (NO prices/tariffs shown) */}
      <div className="absolute inset-x-3 bottom-3 z-10">
        <div className="rounded-xl bg-white/95 backdrop-blur-md border border-emerald-950/10 shadow-lg px-3.5 py-2.5 sm:px-4 sm:py-3">
          {routeLoading ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-forest-900">
              <Navigation className="w-4 h-4 text-grab-600 animate-pulse shrink-0" aria-hidden="true" />
              <span>Menghitung rute perjalanan...</span>
            </div>
          ) : routeMetrics ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-xs sm:text-sm font-semibold text-forest-900">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Navigation className="w-4 h-4 text-grab-600 shrink-0" aria-hidden="true" />
                  <span>{formatDistanceKm(routeMetrics.distanceMeters)}</span>
                </span>
                <span className="text-slate-300" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-4 h-4 text-gold-600 shrink-0" aria-hidden="true" />
                  <span>{formatDurationId(routeMetrics.durationMillis)}</span>
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-500">
                Tarif dikonfirmasi admin via WhatsApp
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <MapPin className="w-4 h-4 text-grab-600 shrink-0" aria-hidden="true" />
              <span>
                {geoError ||
                  routeError ||
                  'Pilih alamat penjemputan & tujuan dari saran lokasi untuk melihat rute.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
