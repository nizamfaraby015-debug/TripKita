import { ChangeEvent, FormEvent, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Loader2,
  MapPin,
  Percent,
  ShieldCheck,
  Upload,
  UserCheck,
} from 'lucide-react';
import { isFirebaseConfigured } from '../../lib/firebase';
import { submitPartnerRegistrationFirestore } from '../../services/firestoreOpsService';
import { submitDemoPartnerRegistration } from '../../services/partnerDemoService';
import {
  PARTNERSHIP_TYPE_LABELS,
  PARTNER_SERVICE_LABELS,
  PARTNER_STATUS_LABELS,
  PartnerDocumentPlaceholder,
  PartnerRegistration,
  PartnerServiceType,
  PartnershipType,
  VEHICLE_AVAILABILITY_LABELS,
  VehicleAvailability,
} from '../../types/partner';

interface PartnerRegistrationFormProps {
  onSubmitted: (record: PartnerRegistration) => void;
}

const STEPS = [
  { id: 1, title: 'Data Pribadi' },
  { id: 2, title: 'Jenis Kemitraan' },
  { id: 3, title: 'Jenis Layanan' },
  { id: 4, title: 'Data Kendaraan' },
  { id: 5, title: 'Perjanjian Komisi' },
  { id: 6, title: 'Dokumen' },
] as const;

type FormErrors = Record<string, string>;

const INITIAL_DOCUMENTS: PartnerDocumentPlaceholder = {
  simFileName: null,
  stnkFileName: null,
  vehiclePhotoFileName: null,
  storageStatus: 'DEMO_NOT_UPLOADED',
};

export function PartnerRegistrationForm({ onSubmitted }: PartnerRegistrationFormProps) {
  const [step, setStep] = useState<number>(1);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<PartnerRegistration | null>(null);

  // Step 1: Data Pribadi
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [regency, setRegency] = useState('');

  // Step 2: Jenis Kemitraan
  const [partnershipType, setPartnershipType] =
    useState<PartnershipType>('PEMILIK_DAN_PENGEMUDI');

  // Step 3: Jenis Layanan
  const [services, setServices] = useState<PartnerServiceType[]>(['MOBIL_PENUMPANG']);
  const [otherServiceNote, setOtherServiceNote] = useState('');

  // Step 4: Data Kendaraan
  const [vehicleBrandType, setVehicleBrandType] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [passengerCapacity, setPassengerCapacity] = useState('4');
  const [operationalArea, setOperationalArea] = useState('');
  const [availability, setAvailability] = useState<VehicleAvailability>('TERSEDIA');

  // Step 5: Perjanjian Komisi 10%
  const [agreedCommission, setAgreedCommission] = useState(false);

  // Step 6: Dokumen (hanya nama berkas untuk simulasi, tidak disimpan ke localStorage)
  const [documents, setDocuments] =
    useState<PartnerDocumentPlaceholder>(INITIAL_DOCUMENTS);

  const clearError = (key: string) => {
    if (!errors[key]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleService = (serviceKey: PartnerServiceType) => {
    clearError('services');
    setServices((prev) =>
      prev.includes(serviceKey)
        ? prev.filter((item) => item !== serviceKey)
        : [...prev, serviceKey]
    );
  };

  const handleFilePlaceholderChange = (
    field: 'simFileName' | 'stnkFileName' | 'vehiclePhotoFileName',
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    setDocuments((prev) => ({
      ...prev,
      [field]: file ? file.name : null,
      storageStatus: 'DEMO_NOT_UPLOADED',
    }));
  };

  const validateStep = (targetStep: number): FormErrors => {
    const nextErrors: FormErrors = {};

    if (targetStep === 1) {
      if (!fullName.trim()) nextErrors.fullName = 'Nama lengkap wajib diisi.';
      const waDigits = whatsapp.replace(/\D/g, '');
      if (!whatsapp.trim()) {
        nextErrors.whatsapp = 'Nomor WhatsApp wajib diisi.';
      } else if (waDigits.length < 9 || waDigits.length > 15) {
        nextErrors.whatsapp = 'Masukkan nomor WhatsApp yang valid (9–15 digit).';
      }
      if (!email.trim()) {
        nextErrors.email = 'Email wajib diisi.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        nextErrors.email = 'Format email belum valid.';
      }
      if (!address.trim()) nextErrors.address = 'Alamat lengkap wajib diisi.';
      if (!district.trim()) nextErrors.district = 'Kecamatan wajib diisi.';
      if (!regency.trim()) nextErrors.regency = 'Kabupaten/Kota wajib diisi.';
    }

    if (targetStep === 2) {
      if (!partnershipType) {
        nextErrors.partnershipType = 'Pilih jenis kemitraan.';
      }
    }

    if (targetStep === 3) {
      if (services.length === 0) {
        nextErrors.services = 'Pilih minimal 1 jenis layanan.';
      }
      if (services.includes('LAYANAN_LAINNYA') && !otherServiceNote.trim()) {
        nextErrors.otherServiceNote = 'Jelaskan layanan lainnya secara singkat.';
      }
    }

    if (targetStep === 4) {
      if (!vehicleBrandType.trim()) {
        nextErrors.vehicleBrandType = 'Merek dan tipe kendaraan wajib diisi.';
      }
      const yearNum = parseInt(vehicleYear, 10);
      if (!vehicleYear.trim() || Number.isNaN(yearNum) || yearNum < 1995 || yearNum > 2027) {
        nextErrors.vehicleYear = 'Masukkan tahun kendaraan yang valid (contoh: 2022).';
      }
      if (!licensePlate.trim()) {
        nextErrors.licensePlate = 'Nomor polisi wajib diisi.';
      }
      const capNum = parseInt(passengerCapacity, 10);
      if (Number.isNaN(capNum) || capNum < 1 || capNum > 50) {
        nextErrors.passengerCapacity = 'Kapasitas penumpang antara 1 hingga 50 orang.';
      }
      if (!operationalArea.trim()) {
        nextErrors.operationalArea = 'Area operasional wajib diisi.';
      }
    }

    if (targetStep === 5) {
      if (!agreedCommission) {
        nextErrors.agreedCommission =
          'Anda wajib menyetujui perjanjian komisi 10% TripKita untuk melanjutkan pendaftaran.';
      }
    }

    return nextErrors;
  };

  const handleNextStep = () => {
    const stepErrors = validateStep(step);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(STEPS.length, prev + 1));
  };

  const handlePrevStep = () => {
    setErrors({});
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    if (!agreedCommission) {
      setStep(5);
      setErrors({
        agreedCommission:
          'Anda wajib menyetujui perjanjian komisi 10% TripKita sebelum mengirim pendaftaran.',
      });
      return;
    }
    const finalErrors = validateStep(step);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    const payload = {
      fullName,
      whatsapp,
      email,
      address,
      district,
      regency,
      partnershipType,
      services,
      otherServiceNote: services.includes('LAYANAN_LAINNYA') ? otherServiceNote : undefined,
      vehicleBrandType,
      vehicleYear,
      licensePlate,
      passengerCapacity: Math.min(50, Math.max(1, parseInt(passengerCapacity, 10) || 4)),
      operationalArea,
      availability,
      documents,
    };

    try {
      const record = isFirebaseConfigured
        ? await submitPartnerRegistrationFirestore(payload)
        : submitDemoPartnerRegistration(payload);
      setSubmittedRecord(record);
      onSubmitted(record);
    } catch (err) {
      setSubmitError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'Pendaftaran gagal dikirim ke server. Periksa koneksi internet Anda dan coba kembali.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForNew = () => {
    setSubmittedRecord(null);
    setStep(1);
    setErrors({});
    setFullName('');
    setWhatsapp('');
    setEmail('');
    setAddress('');
    setDistrict('');
    setRegency('');
    setPartnershipType('PEMILIK_DAN_PENGEMUDI');
    setServices(['MOBIL_PENUMPANG']);
    setOtherServiceNote('');
    setVehicleBrandType('');
    setVehicleYear('');
    setLicensePlate('');
    setPassengerCapacity('4');
    setOperationalArea('');
    setAvailability('TERSEDIA');
    setAgreedCommission(false);
    setDocuments(INITIAL_DOCUMENTS);
  };

  const inputClass = (fieldError?: string) =>
    `w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-grab-500/25 focus:border-grab-600 ${
      fieldError ? 'border-red-500 bg-red-50/30' : 'border-slate-300 hover:border-emerald-700/40'
    }`;

  if (submittedRecord) {
    return (
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg shadow-forest-950/5 p-6 sm:p-8">
        <div className="flex items-start gap-3.5">
          <CheckCircle2 className="w-7 h-7 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-extrabold text-xl text-forest-900">
              {isFirebaseConfigured
                ? 'Pendaftaran Mitra Berhasil Dikirim'
                : 'Pendaftaran Mitra Berhasil Dikirim (Mode Demo)'}
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              {isFirebaseConfigured
                ? 'Data pendaftaran Anda telah tersimpan di database TripKita. Simpan nomor pendaftaran di bawah ini untuk memantau status verifikasi admin.'
                : 'Simpan nomor pendaftaran di bawah ini untuk memantau hasil verifikasi admin. Catatan: data ini disimpan sementara di browser untuk simulasi demo.'}
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-forest-50 border border-emerald-950/10">
              <div>
                <span className="block text-xs font-medium text-slate-500">
                  Nomor Pendaftaran
                </span>
                <span className="mt-1 block font-mono font-bold text-lg text-forest-900 tabular-nums">
                  {submittedRecord.registrationNumber}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500">
                  Status Saat Ini
                </span>
                <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-display font-bold text-xs">
                  <ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{PARTNER_STATUS_LABELS[submittedRecord.status]}</span>
                </span>
              </div>
            </div>

            <div className="mt-5 text-sm text-slate-700 space-y-1">
              <p>
                <span className="font-semibold text-forest-900">Nama:</span>{' '}
                {submittedRecord.fullName}
              </p>
              <p>
                <span className="font-semibold text-forest-900">Armada:</span>{' '}
                {submittedRecord.vehicleBrandType} ({submittedRecord.licensePlate})
              </p>
              <p>
                <span className="font-semibold text-forest-900">Verifikasi Dokumen:</span>{' '}
                Tim admin TripKita akan menghubungi WhatsApp Anda untuk pemeriksaan fisik/foto berkas asli.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a
                href="#cek-status"
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] text-white font-display font-bold text-sm inline-flex items-center justify-center gap-2 transition-all"
              >
                <span>Cek Status Pendaftaran</span>
              </a>
              <button
                type="button"
                onClick={handleResetForNew}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-semibold text-sm inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                Daftarkan Mitra Lain
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-950/10 shadow-xl shadow-forest-950/5 p-5 sm:p-8">
      {/* Stepper Header */}
      <div className="mb-7">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-forest-900">
            Formulir Pendaftaran Mitra
          </h2>
          <span className="text-xs sm:text-sm font-semibold text-grab-700 tabular-nums whitespace-nowrap">
            Langkah {step} dari {STEPS.length}
          </span>
        </div>

        <ol className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STEPS.map((item) => {
            const isActive = item.id === step;
            const isDone = item.id < step;
            return (
              <li key={item.id} className="min-w-0">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-grab-600'
                      : isDone
                        ? 'bg-forest-800'
                        : 'bg-slate-200'
                  }`}
                />
                <span
                  className={`mt-1.5 block text-[11px] sm:text-xs truncate ${
                    isActive
                      ? 'font-bold text-forest-900'
                      : isDone
                        ? 'font-semibold text-grab-700'
                        : 'text-slate-500'
                  }`}
                >
                  {item.id}. {item.title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* STEP 1: DATA PRIBADI */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-grab-600" aria-hidden="true" />
              <span>A. Data Pribadi Calon Mitra</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="mitra-fullName" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Nama lengkap <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-fullName"
                  type="text"
                  placeholder="Contoh: Ahmad Kurniawan"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearError('fullName');
                  }}
                  className={inputClass(errors.fullName)}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.fullName}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-whatsapp" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Nomor WhatsApp <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-whatsapp"
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    clearError('whatsapp');
                  }}
                  className={inputClass(errors.whatsapp)}
                />
                {errors.whatsapp && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.whatsapp}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-email" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Email <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-email"
                  type="email"
                  placeholder="Contoh: nama@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError('email');
                  }}
                  className={inputClass(errors.email)}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="mitra-address" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Alamat lengkap <span className="text-grab-600">*</span>
                </label>
                <textarea
                  id="mitra-address"
                  rows={2}
                  placeholder="Jalan, nomor rumah, RT/RW, atau patokan wilayah"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    clearError('address');
                  }}
                  className={`${inputClass(errors.address)} min-h-[76px] resize-y`}
                />
                {errors.address && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.address}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-district" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Kecamatan <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-district"
                  type="text"
                  placeholder="Contoh: Ngaglik"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    clearError('district');
                  }}
                  className={inputClass(errors.district)}
                />
                {errors.district && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.district}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-regency" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Kabupaten / Kota <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-regency"
                  type="text"
                  placeholder="Contoh: Sleman"
                  value={regency}
                  onChange={(e) => {
                    setRegency(e.target.value);
                    clearError('regency');
                  }}
                  className={inputClass(errors.regency)}
                />
                {errors.regency && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.regency}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: JENIS KEMITRAAN */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-grab-600" aria-hidden="true" />
              <span>B. Pilih Jenis Kemitraan</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(PARTNERSHIP_TYPE_LABELS) as PartnershipType[]).map((key) => {
                const selected = partnershipType === key;
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? 'border-grab-600 bg-forest-50/80 text-forest-950'
                        : 'border-slate-200 hover:border-emerald-700/40 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="partnershipType"
                      value={key}
                      checked={selected}
                      onChange={() => {
                        setPartnershipType(key);
                        clearError('partnershipType');
                      }}
                      className="w-4 h-4 accent-[#008F40]"
                    />
                    <span className="font-display font-semibold text-sm sm:text-base">
                      {PARTNERSHIP_TYPE_LABELS[key]}
                    </span>
                  </label>
                );
              })}
            </div>
            {errors.partnershipType && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.partnershipType}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP 3: JENIS LAYANAN */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900 pb-2 border-b border-slate-100">
              <MapPin className="w-4 h-4 text-grab-600" aria-hidden="true" />
              <span>C. Jenis Layanan yang Disediakan</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              Pilih satu atau lebih jenis layanan yang sesuai dengan armada Anda.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(PARTNER_SERVICE_LABELS) as PartnerServiceType[]).map((key) => {
                const checked = services.includes(key);
                return (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? 'border-grab-600 bg-forest-50/80 text-forest-950'
                        : 'border-slate-200 hover:border-emerald-700/40 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(key)}
                      className="w-4 h-4 rounded accent-[#008F40]"
                    />
                    <span className="font-medium text-sm">
                      {PARTNER_SERVICE_LABELS[key]}
                    </span>
                  </label>
                );
              })}
            </div>

            {services.includes('LAYANAN_LAINNYA') && (
              <div>
                <label htmlFor="mitra-otherService" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Keterangan layanan lainnya <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-otherService"
                  type="text"
                  placeholder="Contoh: Angkut barang pindahan atau wisata grup"
                  value={otherServiceNote}
                  onChange={(e) => {
                    setOtherServiceNote(e.target.value);
                    clearError('otherServiceNote');
                  }}
                  className={inputClass(errors.otherServiceNote)}
                />
                {errors.otherServiceNote && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.otherServiceNote}</span>
                  </p>
                )}
              </div>
            )}

            {errors.services && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.services}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP 4: DATA KENDARAAN */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900 pb-2 border-b border-slate-100">
              <Car className="w-4 h-4 text-grab-600" aria-hidden="true" />
              <span>D. Data Kendaraan & Operasional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mitra-vehicleBrand" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Merek dan tipe kendaraan <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-vehicleBrand"
                  type="text"
                  placeholder="Contoh: Toyota Avanza Veloz"
                  value={vehicleBrandType}
                  onChange={(e) => {
                    setVehicleBrandType(e.target.value);
                    clearError('vehicleBrandType');
                  }}
                  className={inputClass(errors.vehicleBrandType)}
                />
                {errors.vehicleBrandType && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.vehicleBrandType}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-vehicleYear" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Tahun kendaraan <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-vehicleYear"
                  type="number"
                  min={1995}
                  max={2027}
                  placeholder="Contoh: 2023"
                  value={vehicleYear}
                  onChange={(e) => {
                    setVehicleYear(e.target.value);
                    clearError('vehicleYear');
                  }}
                  className={inputClass(errors.vehicleYear)}
                />
                {errors.vehicleYear && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.vehicleYear}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-licensePlate" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Nomor polisi <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-licensePlate"
                  type="text"
                  placeholder="Contoh: AB 1428 TK"
                  value={licensePlate}
                  onChange={(e) => {
                    setLicensePlate(e.target.value.toUpperCase());
                    clearError('licensePlate');
                  }}
                  className={inputClass(errors.licensePlate)}
                />
                {errors.licensePlate && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.licensePlate}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-capacity" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Kapasitas penumpang <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-capacity"
                  type="number"
                  min={1}
                  max={50}
                  value={passengerCapacity}
                  onChange={(e) => {
                    setPassengerCapacity(e.target.value);
                    clearError('passengerCapacity');
                  }}
                  className={inputClass(errors.passengerCapacity)}
                />
                {errors.passengerCapacity && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.passengerCapacity}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-operationalArea" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Area operasional <span className="text-grab-600">*</span>
                </label>
                <input
                  id="mitra-operationalArea"
                  type="text"
                  placeholder="Contoh: Yogyakarta, Sleman, Bandara YIA"
                  value={operationalArea}
                  onChange={(e) => {
                    setOperationalArea(e.target.value);
                    clearError('operationalArea');
                  }}
                  className={inputClass(errors.operationalArea)}
                />
                {errors.operationalArea && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.operationalArea}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="mitra-availability" className="block text-xs sm:text-sm font-semibold text-forest-900 mb-1.5">
                  Ketersediaan kendaraan <span className="text-grab-600">*</span>
                </label>
                <select
                  id="mitra-availability"
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value as VehicleAvailability)}
                  className={inputClass()}
                >
                  {(Object.keys(VEHICLE_AVAILABILITY_LABELS) as VehicleAvailability[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {VEHICLE_AVAILABILITY_LABELS[key]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: KETERANGAN & PERJANJIAN KOMISI 10% */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900 pb-2 border-b border-slate-100">
              <Percent className="w-4 h-4 text-grab-600" aria-hidden="true" />
              <span>E. Keterangan &amp; Perjanjian Komisi Mitra (10%)</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/75 p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-emerald-950">
              <div className="flex items-start gap-2.5">
                <FileText className="w-5 h-5 text-grab-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-forest-900">
                    Ketentuan Resmi Kemitraan &amp; Komisi TripKita 10%
                  </h3>
                  <p className="mt-1 text-emerald-900/90 leading-relaxed">
                    Sebelum melanjutkan dan mengirimkan data pendaftaran, harap baca serta pahami ketentuan pembagian hasil resmi TripKita berikut:
                  </p>
                </div>
              </div>

              <ul className="space-y-2 pl-1 text-slate-800 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Komisi Platform 10%:</strong> TripKita mengenakan biaya komisi resmi sebesar <strong>10% dari Tarif Jasa</strong> untuk setiap perjalanan yang berhasil diselesaikan (berstatus Selesai).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Tol, Parkir &amp; Biaya Tambahan 100% Milik Mitra:</strong> Pengeluaran tol, parkir, penyeberangan, atau biaya tambahan lapangan di luar tarif jasa tidak dikenakan potongan komisi 10%.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Pembayaran Tunai &amp; Setoran Mingguan:</strong> Pembayaran dari pelanggan diterima langsung oleh mitra di lapangan, dan total komisi 10% disetorkan secara berkala mingguan melalui rekening resmi TripKita.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong>Transparansi Penugasan:</strong> Mitra berhak melihat rincian rute dan tarif jasa terlebih dahulu sebelum menyetujui penawaran perjalanan dari admin.
                  </span>
                </li>
              </ul>
            </div>

            <label
              htmlFor="mitra-agreedCommission"
              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                agreedCommission
                  ? 'border-grab-600 bg-forest-50 text-forest-950'
                  : errors.agreedCommission
                    ? 'border-red-400 bg-red-50/40 text-slate-900'
                    : 'border-slate-300 hover:border-emerald-700/40 bg-white text-slate-800'
              }`}
            >
              <input
                id="mitra-agreedCommission"
                type="checkbox"
                checked={agreedCommission}
                onChange={(e) => {
                  setAgreedCommission(e.target.checked);
                  clearError('agreedCommission');
                }}
                className="mt-0.5 w-4 h-4 rounded accent-[#008F40] shrink-0 cursor-pointer"
              />
              <span className="text-xs sm:text-sm font-medium leading-relaxed">
                Saya telah membaca, memahami, dan <strong>setuju dengan perjanjian komisi 10%</strong> serta ketentuan kemitraan TripKita untuk melanjutkan pengiriman data pendaftaran.
              </span>
            </label>

            {errors.agreedCommission && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{errors.agreedCommission}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP 6: DOKUMEN */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-sm font-display font-bold text-forest-900">
                <FileCheck2 className="w-4 h-4 text-grab-600" aria-hidden="true" />
                <span>F. Dokumen Kelengkapan</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-grab-600" aria-hidden="true" />
                <span>Komisi 10% Disetujui</span>
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs sm:text-sm text-emerald-950 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-grab-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">
                  Perlindungan Privasi Berkas Identitas
                </p>
                <p className="mt-1 text-emerald-900/90 leading-relaxed">
                  Untuk menjaga keamanan identitas Anda, formulir ini hanya mencatat nama berkas kelengkapan Anda. Pemeriksaan foto SIM, STNK, dan unit kendaraan dilakukan langsung oleh admin TripKita melalui WhatsApp resmi setelah data pendaftaran diterima.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {[
                {
                  id: 'doc-sim',
                  field: 'simFileName' as const,
                  label: 'SIM Pengemudi (A / B1)',
                  currentName: documents.simFileName,
                },
                {
                  id: 'doc-stnk',
                  field: 'stnkFileName' as const,
                  label: 'STNK Kendaraan',
                  currentName: documents.stnkFileName,
                },
                {
                  id: 'doc-vehicle',
                  field: 'vehiclePhotoFileName' as const,
                  label: 'Foto Kendaraan Tampak Depan',
                  currentName: documents.vehiclePhotoFileName,
                },
              ].map((docItem) => (
                <div
                  key={docItem.id}
                  className="p-4 rounded-xl border border-slate-200 bg-forest-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <label
                      htmlFor={docItem.id}
                      className="block text-sm font-semibold text-forest-900"
                    >
                      {docItem.label}
                    </label>
                    <span className="text-xs text-slate-500">
                      {docItem.currentName
                        ? `Dipilih untuk simulasi: ${docItem.currentName} (tidak diunggah)`
                        : 'Opsional pada mode demo'}
                    </span>
                  </div>

                  <label
                    htmlFor={docItem.id}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-forest-50 border border-slate-300 text-forest-900 font-display font-semibold text-xs inline-flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-grab-600" aria-hidden="true" />
                    <span>{docItem.currentName ? 'Ganti Pilihan' : 'Pilih Berkas'}</span>
                    <input
                      id={docItem.id}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFilePlaceholderChange(docItem.field, e)}
                      className="sr-only"
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="min-h-[46px] px-4 sm:px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-display font-semibold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Sebelumnya</span>
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length ? (
            <button
              type="button"
              disabled={step === 5 && !agreedCommission}
              onClick={handleNextStep}
              className="min-h-[46px] px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/20 transition-all"
            >
              <span>Lanjutkan</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting || !agreedCommission}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#00A84B] to-[#008A3C] hover:from-[#009944] hover:to-[#007834] disabled:opacity-60 disabled:cursor-not-allowed text-white font-display font-bold text-sm inline-flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/25 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Menyimpan Pendaftaran...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Kirim Pendaftaran Mitra</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
