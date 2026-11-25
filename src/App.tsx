/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BookingForm } from './components/BookingForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { BookingFormData, INITIAL_BOOKING_FORM_DATA, TRIP_TYPE_LABELS, TripType } from './types/booking';

const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const PartnerPortalPage = lazy(() =>
  import('./pages/PartnerPortalPage').then((m) => ({ default: m.PartnerPortalPage }))
);

const BOOKING_DRAFT_STORAGE_KEY = 'tripkita_booking_draft_v1';

function loadSavedBookingDraft(): BookingFormData {
  try {
    const raw = window.localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return INITIAL_BOOKING_FORM_DATA;
    const parsed = JSON.parse(raw) as Partial<BookingFormData>;
    const validTripType: TripType =
      parsed.jenisPerjalanan && parsed.jenisPerjalanan in TRIP_TYPE_LABELS
        ? (parsed.jenisPerjalanan as TripType)
        : INITIAL_BOOKING_FORM_DATA.jenisPerjalanan;
    return {
      ...INITIAL_BOOKING_FORM_DATA,
      ...parsed,
      jenisPerjalanan: validTripType,
    };
  } catch {
    return INITIAL_BOOKING_FORM_DATA;
  }
}

function CustomerHomePage() {
  const [formData, setFormData] = useState<BookingFormData>(() => loadSavedBookingDraft());

  useEffect(() => {
    try {
      window.localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(formData));
    } catch {
      // Abaikan jika storage browser tidak tersedia
    }
  }, [formData]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6FAF8] text-slate-900">
      <main className="flex-1">
        <HeroSection />

        <BookingForm formData={formData} onChange={setFormData} />
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen bg-[#F6FAF8] flex items-center justify-center text-sm font-medium text-forest-900">
              Memuat halaman...
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<CustomerHomePage />} />
            <Route path="/mitra" element={<PartnerPortalPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
