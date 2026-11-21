import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import { LatLngLiteral, isQuotaExceededError } from '../types/booking';

interface PlacesAutocompleteInputProps {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  value: string;
  pinColorClass: string;
  error?: string;
  errorId?: string;
  mapsAvailable: boolean;
  onTextChange: (value: string) => void;
  onPlaceSelected: (address: string, coord: LatLngLiteral | null) => void;
}

export function PlacesAutocompleteInput({
  id,
  name,
  label,
  placeholder,
  value,
  pinColorClass,
  error,
  errorId,
  mapsAvailable,
  onTextChange,
  onPlaceSelected,
}: PlacesAutocompleteInputProps) {
  const placesLib = useMapsLibrary('places');
  const [isOpen, setIsOpen] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [allowQuery, setAllowQuery] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { suggestions, isLoading, resetSession } = useAutocompleteSuggestions(
    value,
    mapsAvailable && allowQuery
  );

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;

    const fallbackText = prediction.text?.text ?? value;
    setAllowQuery(false);
    setIsOpen(false);

    if (!placesLib) {
      onPlaceSelected(fallbackText, null);
      resetSession();
      return;
    }

    setIsFetchingDetails(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });

      const resolvedAddress =
        place.formattedAddress || place.displayName || fallbackText;
      const resolvedCoord = place.location
        ? { lat: place.location.lat(), lng: place.location.lng() }
        : null;

      onPlaceSelected(resolvedAddress, resolvedCoord);
    } catch (err) {
      if (isQuotaExceededError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      onPlaceSelected(fallbackText, null);
    } finally {
      setIsFetchingDetails(false);
      resetSession();
    }
  };

  const borderClass = error
    ? 'border-red-500 bg-red-50/30'
    : 'border-slate-300 hover:border-emerald-700/40';

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5"
      >
        {label} <span className="text-grab-600">*</span>
      </label>

      <div className="relative">
        <MapPin
          className={`w-4 h-4 ${pinColorClass} absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none`}
          aria-hidden="true"
        />
        <input
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onChange={(e) => {
            setAllowQuery(true);
            setIsOpen(true);
            onTextChange(e.target.value);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`w-full min-h-[48px] pl-10 pr-9 py-2.5 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 text-sm sm:text-base transition-colors focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600 ${borderClass}`}
        />
        {(isLoading || isFetchingDetails) && (
          <Loader2
            className="w-4 h-4 text-grab-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label={`Saran alamat untuk ${label}`}
          className="absolute z-30 mt-1.5 w-full rounded-xl bg-white border border-emerald-950/15 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100"
        >
          {suggestions.map((suggestion, idx) => {
            const mainText = suggestion.placePrediction?.mainText?.text;
            const secondaryText = suggestion.placePrediction?.secondaryText?.text;
            const fullText = suggestion.placePrediction?.text?.text ?? '';
            return (
              <li key={suggestion.placePrediction?.placeId ?? idx}>
                <button
                  type="button"
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left hover:bg-forest-50 transition-colors flex items-start gap-2.5 cursor-pointer"
                >
                  <MapPin
                    className="w-4 h-4 text-grab-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    {mainText ? (
                      <>
                        <span className="block text-sm font-semibold text-forest-900 truncate">
                          {mainText}
                        </span>
                        {secondaryText && (
                          <span className="block text-xs text-slate-500 truncate">
                            {secondaryText}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="block text-sm text-slate-800">
                        {fullText}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
