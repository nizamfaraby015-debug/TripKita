/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { BookingForm } from './components/BookingForm';
import { Footer } from './components/Footer';
import { HeroSection } from './components/HeroSection';
import { BookingFormData } from './types/booking';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const INITIAL_FORM_DATA: BookingFormData = {
  nama: '',
  whatsapp: '',
  penjemputan: '',
  penjemputanCoord: null,
  tujuan: '',
  tujuanCoord: null,
  tanggal: '',
  jam: '',
  penumpang: '1',
  catatan: '',
};

export default function App() {
  const [formData, setFormData] = useState<BookingFormData>(INITIAL_FORM_DATA);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  const mapsAvailable = Boolean(GOOGLE_MAPS_API_KEY);

  const content = (
    <div className="min-h-screen flex flex-col bg-[#F6FAF8] text-slate-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <main className="flex-1">
        <HeroSection />

        <BookingForm
          formData={formData}
          mapsAvailable={mapsAvailable}
          onChange={setFormData}
        />
      </main>

      <Footer />
    </div>
  );

  if (!mapsAvailable) {
    return content;
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      language="id"
      region="ID"
      libraries={['places', 'routes']}
    >
      {content}
    </APIProvider>
  );
}
