/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BookingForm } from './components/BookingForm';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PartnerPortalPage } from './pages/PartnerPortalPage';
import { BookingFormData, INITIAL_BOOKING_FORM_DATA } from './types/booking';

const BOOKING_DRAFT_STORAGE_KEY = 'tripkita_booking_draft_v1';

function loadSavedBookingDraft(): BookingFormData {
  try {
    const raw = window.localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return INITIAL_BOOKING_FORM_DATA;
    const parsed = JSON.parse(raw) as Partial<BookingFormData>;
    return {
      ...INITIAL_BOOKING_FORM_DATA,
      ...parsed,
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
        <Routes>
          <Route path="/" element={<CustomerHomePage />} />
          <Route path="/mitra" element={<PartnerPortalPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
