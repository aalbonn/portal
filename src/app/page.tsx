"use client";
import { Eye, UserCheck, UserClock, Landmark, AlertTriangle, HelpCircle, MapPin, FileCheck, Edit3, ShieldCheck, UserCog, BellRing, Clock, CreditCard, Users, Pencil, Trash2, Plus, X, Building2, Briefcase, FileText, CheckCircle2, AlertCircle, Search, Filter, ArrowUpDown, ChevronDown, LogOut, Eraser, Sparkles, Globe, Ticket, IdCard, User, Lock, ShieldAlert, BadgeCheck, Mail, KeyRound } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function toTitleCase(str: string) {
  if (!str) return "";
  return str.toLocaleLowerCase("tr-TR").replace(/(^|\s)\S/g, l => l.toLocaleUpperCase("tr-TR"));
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";
  const currentUserDisplayName = (session?.user as any)?.nickname || session?.user?.name || "Yetkili";

  const [activeTab, setActiveTab] = useState<"candidates" | "companies" | "demands" | "expiring_refs" | "fee_payments" | "users" | "logs" | "expired">("candidates");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [demandsList, setDemandsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [logsList, setLogsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sıralama State'leri
  const [candidateSort, setCandidateSort] = useState<{ column: string; direction: "asc" | "desc" }>({ column: "registrationNo", direction: "desc" });
  const [companySort, setCompanySort] = useState<{ column: string; direction: "asc" | "desc" }>({ column: "name", direction: "asc" });
  const [demandSort, setDemandSort] = useState<{ column: string; direction: "asc" | "desc" }>({ column: "createdAt", direction: "desc" });

  // Modallar
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [viewCandidate, setViewCandidate] = useState<any | null>(null);
  const [ministryCandidate, setMinistryCandidate] = useState<any | null>(null);

  const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  title: "",
  message: "",
  onConfirm: () => {}
    });

  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingDemandId, setEditingDemandId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [candError, setCandError] = useState("");
  const [compError, setCompError] = useState("");
  const [demandError, setDemandError] = useState("");
  const [demandDuplicateConfirm, setDemandDuplicateConfirm] = useState(false);
  const [selectedDemandDetail, setSelectedDemandDetail] = useState<any>(null);
  const [userError, setUserError] = useState("");
  const [ministryError, setMinistryError] = useState("");

  const [candRefTouched, setCandRefTouched] = useState(false);
  const [ministryRefTouched, setMinistryRefTouched] = useState(false);

  const REF_REGEX = /^\d{4}-[a-zA-Z0-9]{8}-\d{4}$/;
  const APP_REGEX = /^\d{7}$/;
  const TAX_NUM_REGEX = /^\d+$/;
  const TAX_OFFICE_REGEX = /^[a-zA-ZçğıöşüÇĞİÖŞÜ\s]+$/;
  const FOREIGN_ID_REGEX = /^\d{11}$/;

  const sortData = (data: any[], sortConfig: { column: string; direction: "asc" | "desc" }) =>{
    if (!data || !Array.isArray(data)) return [];
    return [...data].sort((a, b) =>{
      if (!a || !b) return 0;
      
      let aVal = a[sortConfig.column];
      let bVal = b[sortConfig.column];

      if (sortConfig.column === "company") {
        aVal = a?.company?.name || "";
        bVal = b?.company?.name || "";
      }

      if (aVal === null || aVal === undefined) aVal = "";
      if (bVal === null || bVal === undefined) bVal = "";

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const res = String(aVal).localeCompare(String(bVal), "tr-TR", { numeric: true });
      return sortConfig.direction === "asc" ? res : -res;
    });
  };

  const toTitleCase = (str: string) =>{
    if (!str) return "";
    return str
      .toLocaleLowerCase("tr-TR")
      .split(" ")
      .map((word) =>word ? word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1) : "")
      .join(" ");
  };

  const getRemainingDays = (dateStr?: string | Date | null): number | null =>{
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const expiringCandidates = candidates.filter((c) =>{
    if (!c.refNumber || !c.refExpiryDate) return false;
    if (c.appNumber && c.appNumber.trim() !== "") return false;
    const days = getRemainingDays(c.refExpiryDate);
    return days !== null && days <= 5;
  });

  const feePaymentCandidates = candidates.filter((c: any) =>c.status === "Harç Ödemesi");
  const pendingEntryCandidates = candidates.filter((c: any) =>c.status === "Giriş Bekleniyor" || c.status === "Giriş bekleniyor");

  const logAudit = async (action: string, details: string) =>{
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details })
    });
      if (isSuperAdmin) {
        const res = await fetch("/api/logs");
        if (res.ok) setLogsList(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const shouldShowRefError = (refNo: string, isTouched: boolean) =>{
    if (!refNo) return false;
    const clean = refNo.trim();
    if (clean.length >= 18 || isTouched) {
      return !REF_REGEX.test(clean);
    }
    return false;
  };

  const calculateExpiryFromRef = (refNo: string): string | null =>{
    const cleanRef = refNo.trim();
    if (!REF_REGEX.test(cleanRef)) return null;

    const parts = cleanRef.split("-");
    const yearStr = parts[0];
    const last4 = parts[2];
    const dayStr = last4.slice(0, 2);
    const monthStr = last4.slice(2, 4);

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
      return null;
    }

    const startDate = new Date(year, month, day);
    if (isNaN(startDate.getTime())) return null;

    startDate.setDate(startDate.getDate() + 30);

    const yyyy = startDate.getFullYear();
    const mm = String(startDate.getMonth() + 1).padStart(2, "0");
    const dd = String(startDate.getDate()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  };

  const isPassportExpiryValid = (dateStr: string) =>{
    if (!dateStr) return true;
    const expDate = new Date(dateStr);
    const minValid = new Date();
    minValid.setHours(0, 0, 0, 0);
    minValid.setMonth(minValid.getMonth() + 6);
    return expDate >= minValid;
  };

  const initialCandForm = {
    firstName: "", lastName: "", fatherName: "", motherName: "",
    spouseName: "", gender: "Erkek", birthDate: "", nationality: "Pakistan",
    passportNo: "", passportExpiry: "", profession: "", agency: "",
    salary: "33.030,00", phone: "", status: "Sözleşme Gönderildi", notes: "",
    companyId: "", refNumber: "", refExpiryDate: "", appNumber: "",
    appDate: "", appStatus: "Beklemede", foreignIdNo: "", createdByName: ""
  };

  const initialCompForm = {
    name: "", officialName: "", taxNumber: "", taxOffice: "", companyAddress: "",
    workAddress: "", contactName: "", contactTitle: "", referralPerson: "", phone: "", email: "", notes: "", createdByName: ""
  };

  const initialDemandForm = {
    companyName: "", professions: "", headCount: "", requesterName: "", requesterPhone: "", cityName: "", createdByName: ""
  };

  const initialUserForm = {
    name: "", nickname: "", email: "", password: "", role: "VIEWER"
  };

  const initialMinistryForm = {
    refNumber: "", refExpiryDate: "", appNumber: "",
    appDate: "", appStatus: "Beklemede", foreignIdNo: "", feeDate: "", feeExpiryDate: "" };

  const [candForm, setCandForm] = useState(initialCandForm);
  const [compForm, setCompForm] = useState(initialCompForm);
  const [demandForm, setDemandForm] = useState(initialDemandForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [ministryForm, setMinistryForm] = useState(initialMinistryForm);

  // Otomatik Tarih Atama (Personel Ekle/Düzenle)
  useEffect(() =>{
    const getTodayStr = () =>{
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().split("T")[0];
    };

    if (candForm.appNumber && candForm.appNumber.trim().length > 0) {
      if (!candForm.appDate || candForm.appDate === "") {
        setCandForm(prev =>({ ...prev, appDate: getTodayStr() }));
      }
    } else if (candForm.appNumber === "" && candForm.appDate !== "") {
      setCandForm(prev =>({ ...prev, appDate: "" }));
    }
  }, [candForm.appNumber]);

  // Otomatik Tarih Atama (Bakanlık Hızlı Giriş)
  useEffect(() =>{
    const getTodayStr = () =>{
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().split("T")[0];
    };

    if (ministryForm.appNumber && ministryForm.appNumber.trim().length > 0) {
      if (!ministryForm.appDate || ministryForm.appDate === "") {
        setMinistryForm(prev =>({ ...prev, appDate: getTodayStr() }));
      }
    } else if (ministryForm.appNumber === "" && ministryForm.appDate !== "") {
      setMinistryForm(prev =>({ ...prev, appDate: "" }));
    }
  }, [ministryForm.appNumber]);

  // Sadece İptal/Onay penceresi açıkken ESC tuşu ile kapatma
  useEffect(() =>{
    const handleKeyDown = (e: KeyboardEvent) =>{
      if (e.key === "Escape") {
        setConfirmDialog((prev) =>{
          if (prev.isOpen) {
            return { ...prev, isOpen: false };
          }
          return prev;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () =>window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const requestCancelConfirmation = (onConfirmAction: () =>void) =>{
    setConfirmDialog({
      isOpen: true,
      title: "İşlemi İptal Etmek İstiyor musunuz?",
      message: "Yaptığınız değişiklikler ve doldurulan bilgiler kaydedilmeden silinecektir. Devam etmek istiyor musunuz?",
      onConfirm: () =>{
        onConfirmAction();
        setConfirmDialog((prev) =>({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCandidateRefChange = (val: string) =>{
    const autoDate = calculateExpiryFromRef(val);
    setCandForm((prev) =>{
      const cleanRef = val.trim();
      let newStatus = prev.status;
      if (!cleanRef) {
        newStatus = "Sözleşme Gönderildi";
      } else if (!prev.appNumber || prev.appNumber.trim() === "") {
        newStatus = "Giriş bekleniyor";
      } else {
        newStatus = "Bakanlık Sürecinde";
      }
      return {
        ...prev,
        refNumber: val,
        refExpiryDate: autoDate || prev.refExpiryDate,
        status: newStatus
    };
    });
  };

  const handleMinistryRefChange = (val: string) =>{
    const autoDate = calculateExpiryFromRef(val);
    setMinistryForm((prev) =>({
      ...prev,
      refNumber: val,
      refExpiryDate: autoDate || prev.refExpiryDate
    }));
  };

  useEffect(() =>{
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async () =>{
    setLoading(true);
    try {
      const [candRes, compRes, demRes] = await Promise.all([
        fetch(`/api/candidates?query=${encodeURIComponent(search)}`),
        fetch(`/api/companies?query=${encodeURIComponent(search)}`),
        fetch(`/api/demands?query=${encodeURIComponent(search)}`),
      ]);
      
      const candData = candRes.ok ? await candRes.json() : [];
      const compData = compRes.ok ? await compRes.json() : [];
      const demData = demRes.ok ? await demRes.json() : [];
      setCandidates(Array.isArray(candData) ? candData : []);
      setCompanies(Array.isArray(compData) ? compData : []);
      setDemandsList(Array.isArray(demData) ? demData : []);

      if (isSuperAdmin) {
        const [uRes, lRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/logs")
        ]);
        if (uRes.ok) setUsersList(await uRes.json());
        if (lRes.ok) setLogsList(await lRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() =>{
    if (status === "authenticated") {
      const timer = setTimeout(() =>{
        fetchData();
      }, 300);
      return () =>clearTimeout(timer);
    }
  }, [search, status, isSuperAdmin]);

  const handleSaveCandidate = async (e: React.FormEvent) =>{
    // GÜVENLİ KONTROLLER - PERSONEL
    if (false) {
        candForm.createdByName = typeof currentUserDisplayName !== "undefined" ? currentUserDisplayName : "Yönetici";
    }
    // GÜVENLİ KONTROLLER BİTİŞ
    
    e.preventDefault();
    setCandError("");

    const duplicatePassport = candidates.some(c =>c.passportNo?.trim().toUpperCase() === candForm.passportNo.trim().toUpperCase() && c.id !== editingCandidateId);
    if (duplicatePassport) {
      setCandError("Bu pasaport numarasına sahip başka bir personel zaten mevcut!");
      return;
    }

    const duplicateRef = candForm.refNumber ? candidates.some(c =>c.refNumber?.trim() === candForm.refNumber.trim() && c.id !== editingCandidateId) : false;
    if (duplicateRef) {
      setCandError("Bu referans numarasına sahip başka bir personel zaten mevcut!");
      return;
    }

    if (!candForm.companyId || !candForm.passportExpiry || !candForm.agency) {
      setCandError("Lütfen atanacak şirketi, pasaport bitiş tarihini ve acente adını doldurun!");
      return;
    }

    if (!isPassportExpiryValid(candForm.passportExpiry)) {
      setCandError("Pasaport bitiş tarihi bulunduğumuz tarihten itibaren en az 6 ay sonrası için geçerli olmalıdır!");
      return;
    }

    if (candForm.refNumber) {
      if (!REF_REGEX.test(candForm.refNumber.trim())) {
        const msg = `Geçersiz Referans No formatı: "${candForm.refNumber}"`;
        setCandError(msg);
        logAudit("HATALI_REF_NUMARASI", `${candForm.firstName} ${candForm.lastName}: ${msg}`);
        return;
      }
      if (!candForm.refExpiryDate) {
        setCandError("Referans numarası girildiğinde Referans Son Günü zorunludur!");
        return;
      }
    }

    if (candForm.appNumber) {
      if (!candForm.refNumber) {
        setCandError("Referans numarası yazılmadan başvuru numarası yazılamaz!");
        return;
      }
    }
    if (candForm.appNumber && !APP_REGEX.test(candForm.appNumber.trim())) {
      const msg = `Geçersiz Başvuru No formatı: "${candForm.appNumber}" (Tam 7 sayı olmalı)`;
      setCandError(msg);
      logAudit("HATALI_BASVURU_NO", `${candForm.firstName} ${candForm.lastName}: ${msg}`);
      return;
    }

    if (candForm.appStatus === "Harç Ödemesi" && candForm.foreignIdNo) {
      if (!FOREIGN_ID_REGEX.test(candForm.foreignIdNo.trim())) {
        setCandError("Yabancı Kimlik Numarası tam 11 haneli bir sayı olmalıdır!");
        return;
      }
    }

    const isEdit = !!editingCandidateId;
    const endpoint = isEdit ? `/api/candidates/${editingCandidateId}` : "/api/candidates";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...candForm,
        firstName: String(candForm.firstName || "").trim().toLocaleUpperCase("tr-TR"),
        lastName: String(candForm.lastName || "").trim().toLocaleUpperCase("tr-TR"),
        fatherName: String(candForm.fatherName || "").trim().toLocaleUpperCase("tr-TR"),
        motherName: String(candForm.motherName || "").trim().toLocaleUpperCase("tr-TR"),
        spouseName: String(candForm.spouseName || "").trim().toLocaleUpperCase("tr-TR")
    })
    });

    if (res.ok) {
      setShowCandidateModal(false);
      setEditingCandidateId(null);
      setCandRefTouched(false);
      setCandForm(initialCandForm);
      fetchData();
    } else {
      const err = await res.json();
      setCandError(err.error || "İşlem başarısız.");
      logAudit("KAYIT_BASARISIZ", `${candForm.firstName} ${candForm.lastName}: ${err.error}`);
    }
  };

  const handleSaveMinistry = async (e: React.FormEvent | null, isCleared = false) =>{
    if (e) e.preventDefault();
    setMinistryError("");

    if (!isCleared) {
      if (!ministryForm.refNumber) {
        setMinistryError("Referans Numarası zorunludur!");
        return;
      }
      if (!REF_REGEX.test(ministryForm.refNumber.trim())) {
        const msg = `Hatalı Bakanlık Ref No girişi denendi: "${ministryForm.refNumber}"`;
        setMinistryError(msg);
        logAudit("HATALI_REF_GIRIS", `${ministryCandidate.firstName} ${ministryCandidate.lastName}: ${msg}`);
        return;
      }
      if (!ministryForm.refExpiryDate) {
        setMinistryError("Referans Son Günü zorunludur!");
        return;
      }
      if (ministryForm.appNumber && !APP_REGEX.test(ministryForm.appNumber.trim())) {
        const msg = `Hatalı Bakanlık Başvuru No girişi denendi: "${ministryForm.appNumber}"`;
        setMinistryError(msg);
        logAudit("HATALI_BASVURU_GIRIS", `${ministryCandidate.firstName} ${ministryCandidate.lastName}: ${msg}`);
        return;
      }
      if (ministryForm.appStatus === "Harç Ödemesi" && ministryForm.foreignIdNo) {
        if (!FOREIGN_ID_REGEX.test(ministryForm.foreignIdNo.trim())) {
          setMinistryError("Yabancı Kimlik Numarası tam 11 haneli bir sayı olmalıdır!");
          return;
        }
      }
    }

    const res = await fetch(`/api/candidates/${ministryCandidate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...ministryCandidate,
        refNumber: isCleared ? "" : ministryForm.refNumber.trim(),
        refExpiryDate: isCleared ? "" : ministryForm.refExpiryDate,
        appNumber: isCleared ? "" : ministryForm.appNumber,
        appDate: isCleared ? "" : ministryForm.appDate,
        appStatus: isCleared ? "Beklemede" : ministryForm.appStatus,
        foreignIdNo: isCleared ? "" : ministryForm.foreignIdNo,
        feeDate: isCleared ? null : (ministryForm.feeDate || null),
        feeExpiryDate: isCleared ? null : (ministryForm.feeExpiryDate || null),
        
        
        status: isCleared || !ministryForm.refNumber || ministryForm.refNumber.trim() === "" ? "Sözleşme Gönderildi" : (ministryForm.appStatus === "Reddedildi" ? "Bakanlık Tarafından Reddedildi" : (ministryForm.appStatus === "Onaylandı" ? "Bilet Bekliyor" : (ministryForm.appStatus === "Harç Ödemesi" ? "Harç Ödemesi" : (!ministryForm.appNumber || ministryForm.appNumber.trim() === "" ? "Giriş bekleniyor" : "Bakanlık Sürecinde")))),
        isMinistryCleared: isCleared
    })
    });

    if (res.ok) {
      setMinistryCandidate(null);
      setMinistryRefTouched(false);
      fetchData();
    } else {
      const err = await res.json();
      setMinistryError(err.error || "Bakanlık bilgileri kaydedilemedi.");
      logAudit("BAKANLIK_KAYIT_HATA", `${ministryCandidate.firstName} ${ministryCandidate.lastName}: ${err.error}`);
    }
  };

  const openMinistryModal = (c: any) =>{
    setMinistryCandidate(c);
    setMinistryRefTouched(false);
    const existingRef = c.refNumber || "";
    const autoExpiry = existingRef ? calculateExpiryFromRef(existingRef) : null;

    setMinistryForm({
      refNumber: existingRef,
      refExpiryDate: c.refExpiryDate ? c.refExpiryDate.split("T")[0] : (autoExpiry || ""),
      appNumber: c.appNumber || "",
      appDate: c.appDate ? c.appDate.split("T")[0] : "",
      appStatus: c.appStatus || "Beklemede",
      foreignIdNo: c.foreignIdNo || "",
      feeDate: c.feeDate ? c.feeDate.split("T")[0] : "",
      feeExpiryDate: c.feeExpiryDate ? c.feeExpiryDate.split("T")[0] : "",
    });
    };

  const handleSaveCompany = async (e: any) => {
    e.preventDefault();
    setCompError("");

    if (!compForm.name) {
      setCompError("Şirket adı zorunludur.");
      return;
    }

    if (compForm.taxNo && compForm.taxNo.trim() !== "" && !/^[0-9]{10,11}$/.test(compForm.taxNo.replace(/\s/g, ''))) {
      setCompError(`Şirket: ${compForm.name} - Geçersiz vergi numarası: ${compForm.taxNo}`);
      return;
    }

    if (!TAX_OFFICE_REGEX.test(String(compForm.taxOffice || "").trim())) {
      setCompError("Vergi dairesi sadece harflerden oluşmalıdır!");
      logAudit("SIRKET_GIRIS_HATA", `Şirket: ${compForm.name} - Geçersiz vergi dairesi: ${compForm.taxOffice}`);
      return;
    }

    const isEdit = !!editingCompanyId;
    const endpoint = isEdit ? `/api/companies/${editingCompanyId}` : "/api/companies";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...compForm,
        name: compForm.name.trim().toLocaleUpperCase("tr-TR"),
        officialName: String(compForm.officialName || "").trim().toLocaleUpperCase("tr-TR")
    })
    });

    if (res.ok) {
      setShowCompanyModal(false);
      setEditingCompanyId(null);
      setCompForm(initialCompForm);
      fetchData();
    } else {
      const err = await res.json();
      setCompError(err.error || "Şirket kaydedilemedi.");
      logAudit("SIRKET_KAYIT_HATA", `Şirket: ${compForm.name} - ${err.error}`);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) =>{
    e.preventDefault();
    setUserError("");

    const isEdit = !!editingUserId;
    const endpoint = isEdit ? `/api/users/${editingUserId}` : "/api/users";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm)
    });

    if (res.ok) {
      setShowUserModal(false);
      setEditingUserId(null);
      setUserForm(initialUserForm);
      fetchData();
    } else {
      const err = await res.json();
      setUserError(err.error || "Kullanıcı kaydedilemedi.");
    }
  };

  const handleDeleteCandidate = async (c: any) =>{
    setConfirmDialog({
      isOpen: true,
      title: "Personel Silme Onayı",
      message: `"${c.firstName} ${c.lastName}" adlı personeli ve tüm kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () =>{
        const res = await fetch(`/api/candidates/${c.id}`, { method: "DELETE" });
        if (res.ok) {
          logAudit("PERSONEL_SILINDI", `${c.firstName} ${c.lastName} (No: #${c.registrationNo || '-'}, Pasaport: ${c.passportNo}) silindi.`);
          fetchData();
        }
        setConfirmDialog((prev) =>({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteUser = async (id: string, name: string) =>{
    setConfirmDialog({
      isOpen: true,
      title: "Kullanıcı Silme Onayı",
      message: `"${name}" adlı yetkili kullanıcı hesabını silmek istediğinize emin misiniz?`,
      onConfirm: async () =>{
        const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
        if (res.ok) {
          logAudit("KULLANICI_SILINDI", `"${name}" adlı kullanıcı hesabı silindi.`);
          fetchData();
        }
        setConfirmDialog((prev) =>({ ...prev, isOpen: false }));
      }
    });
  };

  const renderRefStatus = (candidate: any) => {
    // 1. KURAL: Durum "Bakanlık Sürecinde" ise SADECE Başvuru Numarasını göster
    if (candidate.status === "Bakanlık Sürecinde") {
      return (
        <span className="text-[11px] font-mono text-blue-400 pl-1 flex items-center gap-1">
          <Landmark className="w-3 h-3 text-blue-500/80" />
          Bşv No: <span className="text-blue-300 font-semibold">{candidate.appNumber || "Bekleniyor..."}</span>
        </span>
      );
    }

    // 2. KURAL: Durum "Giriş Bekleniyor" ise Referans Numarasını göster
    if ((candidate.status === "Giriş bekleniyor" || candidate.status === "Giriş Bekleniyor") && candidate.refNumber) {
      return (
        <div className="flex flex-col gap-1 items-start">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-bold flex items-center gap-1.5 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            Referans Geldi
          </span>
          <span className="text-[11px] font-mono text-slate-400 pl-1 mt-0.5">
            Ref: <span className="text-slate-200 font-semibold">{candidate.refNumber}</span>
          </span>
        </div>
      );
    }
    
    // 3. KURAL: Diğer aşamalarda başvuru numarası varsa göster
    if (candidate.appNumber) {
      return (
        <span className="text-[11px] font-mono text-blue-400 pl-1 flex items-center gap-1">
          <Landmark className="w-3 h-3 text-blue-500/80" />
          Bşv No: <span className="text-blue-300 font-semibold">{candidate.appNumber}</span>
        </span>
      );
    }
    
    // 4. KURAL: Hiçbiri yoksa
    return (
      <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 font-medium whitespace-nowrap">
        Referans Bekliyor
      </span>
    );
  };

  const renderProcessStatus = (statusStr: string) =>{
    switch (statusStr) {
      case "Giriş bekleniyor":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-medium flex items-center gap-1.5 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Giriş bekleniyor
          </span>
        );
      case "Sözleşme Gönderildi":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium flex items-center gap-1.5 whitespace-nowrap">
            <FileCheck className="w-3.5 h-3.5 shrink-0" />
            Sözleşme Gönderildi
          </span>
        );
      case "Bakanlık Sürecinde":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-white font-medium flex items-center gap-1.5 whitespace-nowrap">
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            Bakanlık Sürecinde
          </span>
        );
      case "Bilet Bekliyor":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold flex items-center gap-1.5 whitespace-nowrap shadow-[0_0_10px_rgba(168,85,247,0.2)]">
            <Ticket className="w-3.5 h-3.5 shrink-0 text-purple-400" />
            Bilet Bekliyor
          </span>
        );
      case "Şirkette Çalışıyor":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1.5 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Şirkette Çalışıyor
          </span>
        );
      case "Bakanlık Tarafından Reddedildi":
      case "Reddedildi":
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-bold flex items-center gap-1.5 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Bakanlık Tarafından Reddedildi
          </span>
        );
      default:
        return (
          <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium whitespace-nowrap">
            {statusStr || "Sözleşme Gönderildi"}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) =>{
    switch(role) {
      case "SUPER_ADMIN":
        return <span className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium whitespace-nowrap inline-flex items-center">Süper Admin</span>;
      case "MANAGER":
        return <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium whitespace-nowrap inline-flex items-center">Yönetici</span>;
      default:
        return <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-medium">Görüntüleyici</span>;
    }
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-medium">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* SOL SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen">
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white font-black tracking-wider text-sm shadow-lg shadow-blue-600/30">VP</div>
            <div>
              <h1 className="font-bold text-white leading-tight text-sm">Personel Portalı</h1>
              <p className="text-[11px] text-slate-400">Yönetim & Takip</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <div className="flex flex-col gap-1 p-1.5 rounded-2xl bg-slate-950/40 border border-slate-800/50">
              <button onClick={() => setActiveTab("candidates")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "candidates" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><Users className="w-4 h-4" /><span>Personeller</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${activeTab === "candidates" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>{candidates.length}</span>
              </button>

              <button onClick={() => setActiveTab("companies")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "companies" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><Building2 className="w-4 h-4" /><span>Şirketler</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${activeTab === "companies" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>{companies.length}</span>
              </button>

              <button onClick={() => setActiveTab("demands")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "demands" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><Briefcase className="w-4 h-4 text-amber-400" /><span>Talepler</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${activeTab === "demands" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>{demandsList.length}</span>
              </button>

              <button onClick={() => setActiveTab("pendingEntry")} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-medium text-sm transition-all cursor-pointer ${activeTab === "pendingEntry" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><Clock className="w-4 h-4 text-purple-400" /><span>Giriş Bekleyenler</span></div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${activeTab === "pendingEntry" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>{pendingEntryCandidates.length}</span>
              </button>

              <button onClick={() => setActiveTab("fee_payments")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "fee_payments" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><CreditCard className="w-4 h-4 text-emerald-400" /><span>Harç Ödemeleri</span></div>
                {feePaymentCandidates.length > 0 && <span className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all duration-300 ${activeTab === 'fee_payments' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-500'}`}>{feePaymentCandidates.length}</span>}
              </button>

              <button onClick={() => setActiveTab("ticketsWaiting")} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${activeTab === "ticketsWaiting" ? "bg-sky-500 text-white shadow-sm" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"}`}>
                <Ticket className="w-[18px] h-[18px] shrink-0" />
                <span className="font-medium text-[15px] whitespace-nowrap flex-1 text-left">Bilet Bekleyenler</span>
                <span className={`ml-auto py-0.5 px-2 rounded-lg text-xs font-medium ${activeTab === "ticketsWaiting" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>{candidates.filter((c) => c.status === "Bilet Bekliyor").length}</span>
              </button>

              <button onClick={() => setActiveTab("expiring_refs")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "expiring_refs" ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                <div className="flex items-center gap-2.5"><Clock className="w-4 h-4 text-amber-400" /><span>Süresi Yaklaşan Refler</span></div>
                {expiringCandidates.length > 0 && <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${expiringCandidates.some(c => (getRemainingDays(c.refExpiryDate) || 0) <= 3) ? "bg-red-500 animate-pulse" : "bg-amber-500"}`}>{expiringCandidates.length}</span>}
              </button>
              
              <button onClick={() => setActiveTab("expired")} className={`w-full flex items-center justify-between p-2 pl-4 rounded-xl transition-all font-medium ${activeTab === "expired" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-slate-500 hover:bg-slate-900 hover:text-red-400 border border-transparent"}`}>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-500/60"></div><span className="text-sm">Kaçan Refler</span></div>
                <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-bold">{candidates.filter(c => c.refExpiryDate && c.refExpiryDate < new Date().toISOString().split("T")[0] && (!c.appNumber || c.appNumber.trim() === "") && c.status !== "Bakanlık Tarafından Reddedildi" && c.status !== "Reddedildi").length}</span>
              </button>
            </div>

            {isSuperAdmin && (
              <div className="pt-4 mt-4 border-t border-slate-800/80 space-y-1.5">
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sistem Yönetimi</div>
                <button onClick={() => setActiveTab("logs")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "logs" ? "bg-red-600 text-white shadow-lg shadow-red-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                  <div className="flex items-center gap-2.5"><BellRing className="w-4 h-4 text-red-400" /><span>Yetkili Bildirimleri</span></div>
                  {logsList.length > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">{logsList.length}</span>}
                </button>
                <button onClick={() => setActiveTab("users")} className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === "users" ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800/60"}`}>
                  <div className="flex items-center gap-2.5"><UserCog className="w-4 h-4" /><span>Kullanıcılar</span></div>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${activeTab === "users" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"}`}>{usersList.length}</span>
                </button>
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                <span>{session?.user?.name}</span>
                {(session?.user as any)?.nickname && <span className="text-[11px] text-emerald-400 font-mono">(@{(session?.user as any)?.nickname})</span>}
              </div>
              <div className="text-[11px] text-blue-400 flex items-center gap-1 font-mono mt-0.5">
                <ShieldCheck className="w-3 h-3" /> {(session?.user as any)?.role || "ADMIN"}
              </div>
            </div>
            <button onClick={() => signOut()} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer" title="Çıkış Yap">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="p-6 border-b border-slate-800 bg-slate-900/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={activeTab === "candidates" ? "Personel no (#prs1), ad, pasaport, yabancı kimlik ara..." : activeTab === "fee_payments" ? "Harç ödemesi bekleyenlerde ara (Ad, pasaport, YKN)..." : activeTab === "companies" ? "Şirket adı, vergi no, referans, yetkili ara..." : activeTab === "demands" ? "Şirket adı, meslek, şehir, talep eden ara..." : activeTab === "expiring_refs" ? "Süresi yaklaşan referanslarda ara..." : activeTab === "logs" ? "Yetkili bildirimlerinde ara..." : "Kullanıcı ara..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "candidates" && (
              <button type="button" onClick={() => { setCandForm(initialCandForm); setEditingCandidateId(null); setShowCandidateModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
                <Plus className="w-4 h-4" /> Personel Ekle
              </button>
            )}
            {activeTab === "companies" && (
              <button type="button" onClick={() => { setCompForm(initialCompForm); setEditingCompanyId(null); setShowCompanyModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
                <Plus className="w-4 h-4" /> Şirket Ekle
              </button>
            )}
            {activeTab === "demands" && (
              <button type="button" onClick={() => { setDemandForm(initialDemandForm); setDemandDuplicateConfirm(false); setEditingDemandId(null); setShowDemandModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
                <Plus className="w-4 h-4" /> Talep Ekle
              </button>
            )}
            {activeTab === "users" && isSuperAdmin && (
              <button type="button" onClick={() => { setUserForm(initialUserForm); setEditingUserId(null); setShowUserModal(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 cursor-pointer">
                <Plus className="w-4 h-4" /> Kullanıcı Ekle
              </button>
            )}
          </div>
        </header>

        {/* Ana İçerik */}
        <main className="p-6 flex-1 overflow-y-auto">
          
          
          {/* PERSONELLER TABLOSU */}
          {activeTab === "candidates" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-4 w-16 cursor-pointer hover:text-white" onClick={() =>setCandidateSort(prev =>({ column: "registrationNo", direction: prev.column === "registrationNo" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        No {candidateSort.column === "registrationNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setCandidateSort(prev =>({ column: "firstName", direction: prev.column === "firstName" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Ad Soyad {candidateSort.column === "firstName" && (candidateSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setCandidateSort(prev =>({ column: "passportNo", direction: prev.column === "passportNo" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Pasaport No {candidateSort.column === "passportNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setCandidateSort(prev =>({ column: "company", direction: prev.column === "company" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Şirket {candidateSort.column === "company" && (candidateSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4">Referans Durumu</th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setCandidateSort(prev =>({ column: "status", direction: prev.column === "status" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Durum {candidateSort.column === "status" && (candidateSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortData(candidates || [], candidateSort).map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold whitespace-nowrap inline-flex items-center">
                            #prs{c.registrationNo || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white text-base">
                            {c.firstName} {c.lastName}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-800 text-blue-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-700/60">
                            {c.passportNo}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap inline-flex items-center">
                            {c.company?.name || "Şirketsiz"}
                          </span>
                        </td>
                        <td className="px-6 py-4">{renderRefStatus(c)}</td>
                        <td className="px-6 py-4">{renderProcessStatus(c.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() =>openMinistryModal(c)} className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer" title="Bakanlık / Referans Girişi">
                              <Landmark className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() =>setViewCandidate(c)} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Personel Detayı">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() =>{ setCandForm({...c, passportExpiry: c.passportExpiry ? String(c.passportExpiry).split("T")[0] : "", appDate: c.appDate ? String(c.appDate).split("T")[0] : "", refExpiryDate: c.refExpiryDate ? String(c.refExpiryDate).split("T")[0] : "" }); setEditingCandidateId(c.id); setShowCandidateModal(true); }} className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer" title="Personeli Düzenle">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() =>handleDeleteCandidate(c)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" title="Personeli Sil">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!candidates || candidates.length === 0) && !loading && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500">Kayıtlı personel bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TALEPLER TABLOSU */}
          {activeTab === "demands" && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-4 w-20">Talep No</th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setDemandSort(prev =>({ column: "companyName", direction: prev.column === "companyName" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Şirket Adı {demandSort.column === "companyName" && (demandSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setDemandSort(prev =>({ column: "professions", direction: prev.column === "professions" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Talep Meslekleri {demandSort.column === "professions" && (demandSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setDemandSort(prev =>({ column: "headCount", direction: prev.column === "headCount" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Toplam Kişi {demandSort.column === "headCount" && (demandSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setDemandSort(prev =>({ column: "requesterName", direction: prev.column === "requesterName" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Talep Eden Kişi {demandSort.column === "requesterName" && (demandSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4">Telefon No</th>
                      <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() =>setDemandSort(prev =>({ column: "cityName", direction: prev.column === "cityName" && prev.direction === "asc" ? "desc" : "asc" }))}>
                        Şehir {demandSort.column === "cityName" && (demandSort.direction === "asc" ? "▲" : "▼")}
                      </th>
                      <th className="px-6 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortData(demandsList || [], demandSort).map((d, index) =>(
                      <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold whitespace-nowrap inline-flex items-center">#{index + 1}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-white whitespace-nowrap inline-flex items-center">{d.companyName}</td>
                        <td className="px-6 py-4">
                          {d.professions ? d.professions.split(" | ").map((p, i) =>{
                            const parts = p.split(":");
                            return (
                              <div key={i} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span className="font-medium text-slate-200">{parts[0] || ""}</span>
                                {parts[1] && <span className="text-[10px] font-bold font-mono bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-blue-400">{parts[1]} Kişi</span>}
                              </div>
                            );
                          }) : "-"}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-blue-400">{d.headCount} Kişi</td>
                        <td className="px-6 py-4 text-slate-200">{d.requesterName}</td>
                        <td className="px-6 py-4 font-mono text-xs">{d.requesterPhone || "-"}</td>
                        <td className="px-6 py-4 font-medium text-amber-400">{d.cityName}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() =>{ setDemandForm(d); setEditingDemandId(d.id); setShowDemandModal(true); }} className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Talebi Düzenle">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={async () =>{
                              setConfirmDialog({
                                isOpen: true, title: "Talep Silme Onayı", message: "Talebi silmek istediğinize emin misiniz?",
                                onConfirm: async () =>{
                                  await fetch("/api/demands/" + d.id, { method: "DELETE" });
                                  fetchData(); setConfirmDialog(prev =>({ ...prev, isOpen: false }));
                                }
                              });
                            }} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" title="Talebi Sil">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!demandsList || demandsList.length === 0) && !loading && (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-500">Kayıtlı talep bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* HARÇ ÖDEMELERİ SEKMESİ */}
          {activeTab === "fee_payments" && (
            <div className="space-y-4 max-w-6xl">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    Harç Ödemesi Bekleyen Personeller
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Bakanlık Başvuru Durumu <strong>"Harç Ödemesi"</strong> olarak işaretlenmiş personeller listelenir.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Toplam: {feePaymentCandidates?.length || 0} Personel
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-4 w-16 cursor-pointer hover:text-white" onClick={() => setCandidateSort(prev => ({ column: "registrationNo", direction: prev.column === "registrationNo" && prev.direction === "asc" ? "desc" : "asc" }))}>No {candidateSort.column === "registrationNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => setCandidateSort(prev => ({ column: "firstName", direction: prev.column === "firstName" && prev.direction === "asc" ? "desc" : "asc" }))}>Personel {candidateSort.column === "firstName" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => setCandidateSort(prev => ({ column: "company", direction: prev.column === "company" && prev.direction === "asc" ? "desc" : "asc" }))}>Şirket {candidateSort.column === "company" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => setCandidateSort(prev => ({ column: "appNumber", direction: prev.column === "appNumber" && prev.direction === "asc" ? "desc" : "asc" }))}>Başvuru No {candidateSort.column === "appNumber" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white" onClick={() => setCandidateSort(prev => ({ column: "foreignIdNo", direction: prev.column === "foreignIdNo" && prev.direction === "asc" ? "desc" : "asc" }))}>YKN {candidateSort.column === "foreignIdNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white whitespace-nowrap" onClick={() => setCandidateSort(prev => ({ column: "feeDate", direction: prev.column === "feeDate" && prev.direction === "asc" ? "desc" : "asc" }))}>Harç Geldiği Gün {candidateSort.column === "feeDate" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white whitespace-nowrap" onClick={() => setCandidateSort(prev => ({ column: "feeExpiryDate", direction: prev.column === "feeExpiryDate" && prev.direction === "asc" ? "desc" : "asc" }))}>Harç Biteceği Gün {candidateSort.column === "feeExpiryDate" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortData(feePaymentCandidates || [], candidateSort).map((c) => {
                        const daysLeft = getRemainingDays(c.feeExpiryDate);
                        let rowColorClass = "hover:bg-slate-800/30 transition-colors";
                        let dateBadgeClass = "font-mono text-amber-400 font-bold whitespace-nowrap";
                        if (daysLeft !== null) {
                          if (daysLeft < 3) {
                            rowColorClass = "bg-red-950/20 hover:bg-red-950/30 transition-colors";
                            dateBadgeClass = "font-mono text-red-400 font-bold whitespace-nowrap animate-pulse";
                          } else if (daysLeft < 10) {
                            rowColorClass = "bg-amber-950/20 hover:bg-amber-950/30 transition-colors";
                            dateBadgeClass = "font-mono text-amber-300 font-bold whitespace-nowrap";
                          } else {
                            rowColorClass = "hover:bg-slate-800/30 transition-colors";
                            dateBadgeClass = "font-mono text-white whitespace-nowrap";
                          }
                        }
                        return (
                        <tr key={c.id} className={rowColorClass}>
                          <td className="px-5 py-4"><span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">#prs{c.registrationNo || "-"}</span></td>
                          <td className="px-6 py-4"><div className="font-semibold text-white">{c.firstName} {c.lastName}</div><div className="text-xs font-mono text-slate-400">{c.passportNo}</div></td>
                          <td className="px-6 py-4 text-slate-300 whitespace-nowrap inline-flex items-center">{c.company?.name || "Şirketsiz"}</td>
                          <td className="px-6 py-4 font-mono font-bold text-blue-400">{c.appNumber || "-"}</td>
                          <td className="px-6 py-4">{c.foreignIdNo ? (<span className="font-mono font-bold text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg whitespace-nowrap inline-flex items-center">{c.foreignIdNo}</span>) : (<span className="text-xs text-amber-400 font-medium italic flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />YKN Girilmedi</span>)}</td>
                          <td className="px-6 py-4 font-mono text-slate-300 whitespace-nowrap">{c.feeDate ? new Date(c.feeDate).toLocaleDateString("tr-TR") : "-"}</td>
                          <td className={dateBadgeClass}>{c.feeExpiryDate ? new Date(c.feeExpiryDate).toLocaleDateString("tr-TR") : "-"}</td>
                          <td className="px-6 py-4 text-right"><button type="button" onClick={() => openMinistryModal(c)} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md cursor-pointer"><IdCard className="w-3.5 h-3.5" />Bakanlık Durumu</button></td>
                        </tr>
                        );
                      })}
                      {(!feePaymentCandidates || feePaymentCandidates.length === 0) && (
                        <tr><td colSpan={8} className="text-center py-12 text-slate-500">Harç ödemesi aşamasında personel bulunmuyor.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* KAÇAN REFLER SEKMESİ */}
          {activeTab === "expired" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Kaçan Refler (Süresi Geçenler)</h1>
                  <p className="text-slate-400 text-sm mt-0.5">Süresi dolmuş olan referans numarasına sahip personeller.</p>
                </div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 font-medium uppercase text-xs border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-4 w-16">No</th>
                        <th className="px-6 py-4">Ad Soyad</th>
                        <th className="px-6 py-4">Pasaport No</th>
                        <th className="px-6 py-4">Referans No</th>
                        <th className="px-6 py-4">Son Geçerlilik Tarihi</th>
                        <th className="px-6 py-4">Şirket</th>
                        <th className="px-6 py-4">Acente</th>
                        <th className="px-6 py-4 text-right">Ref. Giren Yetkili</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(candidates || [])
                        .filter(c =>c.refExpiryDate && c.refExpiryDate < new Date().toISOString().split("T")[0] && (!c.appNumber || c.appNumber.trim() === "") && c.status !== "Bakanlık Tarafından Reddedildi" && c.status !== "Reddedildi")
                        .map((c) =>(
                          <tr key={c.id} className="hover:bg-red-900/20 transition-colors">
                            <td className="px-5 py-4 font-mono text-slate-400">{c.registrationNo}</td>
                            <td className="px-6 py-4 font-semibold text-white">{c.firstName} {c.lastName}</td>
                            <td className="px-6 py-4 font-mono text-slate-300">{c.passportNo}</td>
                            <td className="px-6 py-4 font-mono text-amber-400 font-bold">{c.refNumber}</td>
                            <td className="px-6 py-4 font-mono text-red-400 font-bold">{c.refExpiryDate ? new Date(c.refExpiryDate).toLocaleDateString("tr-TR") : "-"}</td>
                            <td className="px-6 py-4 text-slate-300 whitespace-nowrap inline-flex items-center">{c.company?.name || "-"}</td>
                            <td className="px-6 py-4 text-slate-300">{c.agency || c.acente || "-"}</td>
                            <td className="px-6 py-4 text-right font-medium text-slate-200">{c.createdBy || c.user || c.author || "Sistem"}</td>
                          </tr>
                      ))}
                      {(candidates || []).filter(c => c.refExpiryDate && c.refExpiryDate < new Date().toISOString().split("T")[0] && (!c.appNumber || c.appNumber.trim() === "") && c.status !== "Bakanlık Tarafından Reddedildi" && c.status !== "Reddedildi").length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                            Süresi geçmiş (kaçan) referansa sahip personel bulunmuyor.
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        {/* SÜRESİ YAKLAŞAN REFLER SEKMESİ */}
          {activeTab === "expiring_refs" && (
            <div className="space-y-4 max-w-6xl">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    Süresi Dolan & Yaklaşan Referans Numaraları
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Bu listede referans süresinin dolmasına <strong>5 gün veya daha az</strong> kalan ve henüz başvuru numarası girilmemiş personeller gösterilir.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-4 w-16">No</th>
                        <th className="px-6 py-4">Personel</th>
                        <th className="px-6 py-4">Şirket</th>
                        <th className="px-6 py-4">Referans Numarası</th>
                        <th className="px-6 py-4">Son Geçerlilik Tarihi</th>
                        <th className="px-6 py-4">Kalan Süre / Uyarı</th>
                        <th className="px-6 py-4 text-right">Başvuru No Gir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {expiringCandidates.map((c) =>{
                        const days = getRemainingDays(c.refExpiryDate);
                        const isCritical = days !== null && days <= 3;

                        return (
                          <tr 
                            key={c.id} 
                            className={`transition-colors ${
                              isCritical 
                                ? "bg-red-950/20 hover:bg-red-950/30" 
                                : "bg-amber-950/15 hover:bg-amber-950/25"
                            }`}>
                            <td className="px-5 py-4">
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                #prs{c.registrationNo || "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{c.firstName} {c.lastName}</div>
                              <div className="text-xs font-mono text-slate-400">{c.passportNo}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-300 whitespace-nowrap inline-flex items-center">{c.company?.name || "Şirketsiz"}</td>
                            <td className="px-6 py-4 font-mono font-bold text-white">{c.refNumber}</td>
                            <td className="px-6 py-4 font-mono">
                              {new Date(c.refExpiryDate).toLocaleDateString("tr-TR")}
                            </td>
                            <td className="px-6 py-4">
                              {isCritical ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-xs shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {days !== null && days < 0 ? `Süresi ${Math.abs(days)} Gün Geçti!` : `${days} Gün Kaldı (Kritik)`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                  <Clock className="w-3.5 h-3.5" />
                                  {days} Gün Kaldı (Yaklaşıyor)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>openMinistryModal(c)}
                                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md cursor-pointer"
                              >
                                <Landmark className="w-3.5 h-3.5" />
                                Başvuru No Ekle
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {expiringCandidates.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500">
                            Süresi yaklaşan veya bekleyen referans uyarısı bulunmuyor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

{/* YETKİLİ BİLDİRİMLERİ VE AUDIT LOG */}
          {activeTab === "logs" && isSuperAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-w-5xl">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    Yetkili Hata ve İşlem Denetim Günlüğü
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hangi kullanıcının ne zaman hatalı giriş yaptığını ve bakanlık veri temizlemelerini buradan takip edebilirsiniz.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-4 whitespace-nowrap">İşlemi Yapan Yetkili</th>
                      <th className="px-5 py-4 whitespace-nowrap">Olay Türü</th>
                      <th className="px-5 py-4">Açıklama / Hata Detayı</th>
                      <th className="px-5 py-4 text-right whitespace-nowrap">Tarih & Zaman</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logsList.map((log) =>(
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-semibold text-white">{log.userName}</div>
                          <div className="text-xs text-slate-500 font-mono">{log.userEmail}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                            log.action === "BAŞVURU_NO_GÜNCELLENDİ"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                              : log.action === "BAKANLIK_BİLGİLERİ_TEMİZLENDİ"
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-300 leading-relaxed font-mono">
                          {log.details}
                        </td>
                        <td className="px-5 py-4 text-right text-xs font-mono text-slate-300 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString("tr-TR")} {new Date(log.createdAt).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                    {logsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-500">
                          Henüz kayıtlı bir yetkili hatası veya işlem bildirimi bulunmuyor.
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          
          {/* GİRİŞ BEKLEYENLER SEKMESİ */}
          {activeTab === "pendingEntry" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Giriş Bekleyen Personeller</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Durumu "Giriş Bekleniyor" olan personeller ve detaylı bakanlık bilgileri.</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-4 w-16 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "registrationNo", direction: prev.column === "registrationNo" && prev.direction === "asc" ? "desc" : "asc" }))}>No {candidateSort.column === "registrationNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "firstName", direction: prev.column === "firstName" && prev.direction === "asc" ? "desc" : "asc" }))}>Ad Soyad / Pasaport {candidateSort.column === "firstName" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "company", direction: prev.column === "company" && prev.direction === "asc" ? "desc" : "asc" }))}>Şirket {candidateSort.column === "company" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "refNumber", direction: prev.column === "refNumber" && prev.direction === "asc" ? "desc" : "asc" }))}>Bakanlık Referans No {candidateSort.column === "refNumber" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "refExpiryDate", direction: prev.column === "refExpiryDate" && prev.direction === "asc" ? "desc" : "asc" }))}>Referans Son Günü {candidateSort.column === "refExpiryDate" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "appNumber", direction: prev.column === "appNumber" && prev.direction === "asc" ? "desc" : "asc" }))}>Bakanlık Başvuru No {candidateSort.column === "appNumber" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4">Süreç Durumu</th>
                        <th className="px-6 py-4 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortData(pendingEntryCandidates, candidateSort).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold whitespace-nowrap inline-flex items-center">
                              #prs{c.registrationNo || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{c.firstName} {c.lastName}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{c.passportNo}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-300 whitespace-nowrap inline-flex items-center">{c.company?.name || "Şirketsiz"}</td>
                          <td className="px-6 py-4">
                            {c.refNumber ? (
                              <div className="font-mono text-amber-400 font-bold">{c.refNumber}</div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Girilmemiş</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {c.refExpiryDate ? (
                              <span className="font-mono text-slate-300">
                                {new Date(c.refExpiryDate).toLocaleDateString("tr-TR")}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 italic">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {c.appNumber ? (
                              <div className="font-mono text-blue-400 font-bold">{c.appNumber}</div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Bekleniyor</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold">
                              Giriş Bekleniyor
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>openMinistryModal(c)}
                                className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                title="Bakanlık Girişi"
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>setViewCandidate(c)}
                                className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="Detayları Görüntüle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingEntryCandidates.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500">
                            Giriş bekleyen personel bulunmuyor.
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          
          {/* BİLET BEKLEYENLER SEKMESİ */}
          {activeTab === "ticketsWaiting" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Bilet Bekleyenler</h2>
                  <p className="text-slate-400 text-sm mt-0.5">Bakanlık onayı almış ve uçuş organizasyonu bekleyen personeller.</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-4 w-16 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "registrationNo", direction: prev.column === "registrationNo" && prev.direction === "asc" ? "desc" : "asc" }))}>No {candidateSort.column === "registrationNo" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "firstName", direction: prev.column === "firstName" && prev.direction === "asc" ? "desc" : "asc" }))}>Ad Soyad / Pasaport {candidateSort.column === "firstName" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() =>setCandidateSort(prev =>({ column: "company", direction: prev.column === "company" && prev.direction === "asc" ? "desc" : "asc" }))}>Şirket {candidateSort.column === "company" && (candidateSort.direction === "asc" ? "▲" : "▼")}</th>
                        <th className="px-6 py-4">Bakanlık Durumu</th>
                        <th className="px-6 py-4">Süreç Durumu</th>
                        <th className="px-6 py-4 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortData(candidates.filter((c: any) =>c.status === "Bilet Bekliyor"), candidateSort).map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold whitespace-nowrap inline-flex items-center">
                              #prs{c.registrationNo || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{c.firstName} {c.lastName}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{c.passportNo}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-300 whitespace-nowrap inline-flex items-center">{c.company?.name || "Şirketsiz"}</td>
                          <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
                                {c.appStatus || "Onaylandı"}
                              </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold">
                              Bilet Bekliyor
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>setViewCandidate(c)}
                                className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                title="Detayları Görüntüle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {candidates.filter((c: any) =>c.status === "Bilet Bekliyor").length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-500">
                            Bilet bekleyen personel bulunmuyor.
                          </td>
                        </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* ŞİRKETLER */}
          {activeTab === "companies" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortData(companies, companySort).map((comp) =>(
                <div key={comp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-white leading-snug">{comp.name}</h3>
                      
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>{
                            setCompForm(comp);
                            setEditingCompanyId(comp.id);
                            setShowCompanyModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Şirketi Düzenle"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={async () =>{
                            setConfirmDialog({
                              isOpen: true,
                              title: "Şirket Silme Onayı",
                              message: `"${comp.name}" adlı şirketi silmek istediğinize emin misiniz? (Bu şirkete bağlı personeller \'Şirketsiz\' olarak güncellenecektir.)`,
                              onConfirm: async () =>{
                                const related = candidates.filter(c =>c.companyId === comp.id || (c.company && c.company.id === comp.id));
                                for (const c of related) {
                                  await fetch(`/api/candidates/${c.id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ ...c, companyId: "" })
                                  });
                                }
                                const res = await fetch(`/api/companies/${comp.id}`, { method: "DELETE" });
                                const d = await res.json();
                                if (res.ok) {
                                  logAudit("SIRKET_SILINDI", `"${comp.name}" adlı şirket silindi.`);
                                  fetchData();
                                } else {
                                  alert(d.error || "Silinemedi.");
                                }
                                setConfirmDialog((prev) =>({ ...prev, isOpen: false }));
                              }
    });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Şirketi Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300 font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 mb-3">
                      <FileCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <div>VN: <span className="text-white">{comp.taxNumber}</span> • VD: <span className="text-white">{comp.taxOffice}</span></div>
                    </div>

                    <div className="space-y-2 text-xs text-slate-400">
                      {comp.officialName && (
                        <div className="flex items-start gap-1.5 pb-2 mb-1.5 border-b border-slate-800/60">
                          <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <div className="leading-snug">
                            <span className="text-slate-300 font-medium">Resmi Ünvan:</span> <span className="text-slate-400">{comp.officialName}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div><span className="text-slate-300 font-medium">Şirket Adresi:</span> {comp.companyAddress}</div>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div><span className="text-slate-300 font-medium">Yabancı Çalışma Adresi:</span> {comp.workAddress}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-3 mt-2">
                    <div className="flex items-center justify-between text-slate-300 mb-2">
                      <span className="text-xs bg-slate-800 text-blue-400 border border-slate-700 px-2 py-0.5 rounded-lg">
                        {comp.candidates?.length || 0} Personel Kayıtlı
                      </span>
                      <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 whitespace-nowrap inline-flex items-center">
                        Ekleme Yapan: {comp.createdByName || "Sistem"}
                      </span>
                    </div>
                    {comp.referralPerson && (
                      <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                        <UserCheck className="w-3.5 h-3.5 shrink-0" />
                        <span>Referans: {comp.referralPerson}</span>
                      </div>
                    )}
                    {comp.contactName && <div><span className="text-slate-500">Yetkili:</span> <span className="text-slate-300">{comp.contactName} {comp.contactTitle ? <span className="text-slate-500 text-[11px] ml-1">({comp.contactTitle})</span> : null}</span></div>}
                    {comp.phone && <div><span className="text-slate-500">Telefon:</span> <span className="text-slate-300">{comp.phone}</span></div>}
                    {comp.notes && <div className="text-slate-500 italic mt-1">"${comp.notes}"</div>}
                  </div>
                </div>
              ))}
              {companies.length === 0 && !loading && (
                <div className="col-span-full text-center py-12 text-slate-500">Kayıtlı şirket bulunamadı.</div>
              )}
            </div>
          )}

          {/* KULLANICILAR */}
          {activeTab === "users" && isSuperAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl max-w-4xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">Yetkili Kullanıcı Listesi</h3>
                  <p className="text-xs text-slate-400">Panele giriş yapabilecek personeller, takma adları (nickname) ve rollerini yönetin.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-slate-950/60 text-slate-300 font-semibold text-xs uppercase border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-4">Kullanıcı & Takma Ad</th>
                      <th className="px-5 py-4">E-Posta</th>
                      <th className="px-5 py-4">Yetki Rolü</th>
                      <th className="px-5 py-4 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersList.map((u) =>(
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{u.name}</div>
                              {u.nickname && (
                                <div className="text-[11px] font-mono text-emerald-400 font-normal">@{u.nickname}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-slate-300">{u.email}</td>
                        <td className="px-5 py-4">{getRoleBadge(u.role)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>{
                                setUserForm(u);
                                setEditingUserId(u.id);
                                setShowUserModal(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Kullanıcıyı Düzenle"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            {(session?.user as any)?.id !== u.id && (
                              <button
                                type="button"
                                onClick={() =>handleDeleteUser(u.id, u.name)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PERSONEL DETAY PENCERESİ */}
      {viewCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) =>e.stopPropagation()}
            className="relative w-full max-w-4xl transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl font-bold font-mono">
                  #prs{viewCandidate.registrationNo || "-"}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {viewCandidate.firstName} {viewCandidate.lastName}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">{viewCandidate.profession}</span>
                    <span className="text-slate-600">•</span>
                    {renderProcessStatus(viewCandidate.status)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                {viewCandidate.appNumber && (
                  <span className="text-[11px] font-mono text-slate-300 bg-blue-950/40 border border-blue-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-400">Sisteme Giriş Yapan:</span>
                    <strong className="text-blue-300 font-semibold">{viewCandidate.appCreatedByName || "Sistem"}</strong>
                  </span>
                )}
                <span className="text-[11px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Ekleme Yapan:</span>
                  <strong className="text-emerald-400 font-semibold">{viewCandidate.createdByName || "Sistem"}</strong>
                </span>
                <button
                  type="button"
                  onClick={() =>setViewCandidate(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Globe className="w-3.5 h-3.5" /> Pasaport ve Kimlik
                </div>
                <div><span className="text-slate-500">Personel Sıra No:</span> <span className="font-mono text-blue-400 font-bold">#prs{viewCandidate.registrationNo}</span></div>
                <div><span className="text-slate-500">Pasaport No:</span> <span className="font-mono text-white font-semibold">{viewCandidate.passportNo}</span></div>
                
                {viewCandidate.passportExpiry && (
                  <div>
                    <span className="text-slate-500">Pasaport Bitiş:</span>{" "}
                    <span className="text-emerald-400 font-mono font-medium">
                      {new Date(viewCandidate.passportExpiry).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                )}
                <div><span className="text-slate-500">Uyruk:</span> <span className="text-slate-200">{viewCandidate.nationality || "Pakistan"}</span></div>
                <div><span className="text-slate-500">Cinsiyet:</span> <span className="text-slate-200">{viewCandidate.gender || "Erkek"}</span></div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5" /> Aile Bilgileri
                </div>
                <div><span className="text-slate-500">Baba Adı:</span> <span className="text-white font-medium">{viewCandidate.fatherName}</span></div>
                <div><span className="text-slate-500">Anne Adı:</span> <span className="text-slate-200">{viewCandidate.motherName || "-"}</span></div>
                <div><span className="text-slate-500">Eşinin Adı:</span> <span className="text-slate-200">{viewCandidate.spouseName || "-"}</span></div>
              </div>

              <div className="bg-red-950/20 border border-red-500/30 p-4 rounded-xl space-y-2.5 md:col-span-2">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Landmark className="w-3.5 h-3.5" /> Bakanlık ve Başvuru Takibi
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <span className="text-slate-400 text-xs">Referans Numarası:</span>
                    <div className="font-mono text-white font-bold text-sm mt-0.5">{viewCandidate.refNumber || "Girilmedi"}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Referans Son Günü:</span>
                    <div className="text-red-300 font-medium text-sm mt-0.5">
                      {viewCandidate.refExpiryDate ? new Date(viewCandidate.refExpiryDate).toLocaleDateString("tr-TR") : "-"}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Başvuru Numarası:</span>
                    <div className="font-mono text-slate-200 text-sm mt-0.5">{viewCandidate.appNumber || "-"}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Bakanlık Durumu:</span>
                    <div className="text-amber-300 font-bold text-sm mt-0.5">{viewCandidate.appStatus || "Beklemede"}</div>
                  </div>
                  {viewCandidate.foreignIdNo && (
                    <div>
                      <span className="text-slate-400 text-xs">Yabancı Kimlik No:</span>
                      <div className="font-mono text-emerald-400 font-bold text-sm mt-0.5">{viewCandidate.foreignIdNo}</div>
                  {(viewCandidate.status === "Harç Ödemesi" || viewCandidate.appStatus === "Harç Ödemesi") && viewCandidate.feeExpiryDate && (
                    <div className="bg-amber-950/20 border border-amber-500/20 p-2.5 rounded-xl animate-in fade-in duration-200">
                      <span className="text-[11px] text-amber-500/80 block font-medium uppercase tracking-wider mb-0.5">Harç Son Günü</span>
                      <span className="text-amber-400 font-mono font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(viewCandidate.feeExpiryDate).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                  )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2.5 md:col-span-2">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5" /> İstihdam & Şirket Bilgileri
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div><span className="text-slate-500">Atanan Şirket:</span> <span className="text-purple-300 font-semibold whitespace-nowrap inline-flex items-center">{viewCandidate.company?.name || "Şirketsiz"}</span></div>
                  <div><span className="text-slate-500">Meslek / Görev:</span> <span className="text-slate-200 font-medium">{viewCandidate.profession}</span></div>
                  <div><span className="text-slate-500">Acente:</span> <span className="text-emerald-300 font-semibold">{viewCandidate.agency || "-"}</span></div>
                  <div><span className="text-slate-500">Maaş Bilgisi:</span> <span className="text-amber-300 font-semibold">{viewCandidate.salary || "33.030,00"} ₺</span></div>
                  <div><span className="text-slate-500">Telefon:</span> <span className="text-slate-200">{viewCandidate.phone || "-"}</span></div>
                  <div><span className="text-slate-500">Kayıt Tarihi:</span> <span className="text-slate-400">{new Date(viewCandidate.createdAt).toLocaleString("tr-TR")}</span></div>
                </div>
              </div>

              {viewCandidate.notes && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-1.5 md:col-span-2">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Özel Notlar</div>
                  <p className="text-slate-300 italic whitespace-pre-line text-xs">{viewCandidate.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-5">
              <button
                type="button"
                onClick={() =>setViewCandidate(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-medium transition-all text-sm cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

                  {/* PERSONEL EKLE/DÜZENLE MODAL */}
      {showCandidateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">{editingCandidateId ? "Personeli Düzenle" : "Yeni Personel Ekle"}</h2>
                <p className="text-xs text-slate-400">Personel bilgilerini eksiksiz doldurunuz.</p>
              </div>
              <button 
                type="button"
                onClick={() => requestCancelConfirmation(() => setShowCandidateModal(false))} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {candError && <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4">{candError}</div>}
            
            {[candForm.firstName, candForm.lastName, candForm.fatherName, candForm.motherName, candForm.spouseName, candForm.birthPlace, candForm.passportNo, candForm.agency, candForm.cnicNo, candForm.phone, candForm.nationality].some(val => val && /[çğıöşüÇĞİÖŞÜ]/.test(val)) && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-xl mb-4 flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                DİKKAT: Formda Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü vb.) kullandınız!
              </div>
            )}
            
            <form onSubmit={handleSaveCandidate} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Ad *</label>
                  <input required value={candForm.firstName || ""} onChange={(e) => setCandForm({...candForm, firstName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Soyad *</label>
                  <input required value={candForm.lastName || ""} onChange={(e) => setCandForm({...candForm, lastName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Doğum Tarihi *</label>
                  <input type="date" required value={candForm.birthDate ? candForm.birthDate.split('T')[0] : ""} onChange={(e) => setCandForm({...candForm, birthDate: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Doğum Yeri *</label>
                  <input required value={candForm.birthPlace || ""} onChange={(e) => setCandForm({...candForm, birthPlace: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Baba Adı *</label>
                  <input required value={candForm.fatherName || ""} onChange={(e) => setCandForm({...candForm, fatherName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Anne Adı</label>
                  <input value={candForm.motherName || ""} onChange={(e) => setCandForm({...candForm, motherName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Eş Adı</label>
                  <input value={candForm.spouseName || ""} onChange={(e) => setCandForm({...candForm, spouseName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Cinsiyet</label>
                  <select value={candForm.gender || "Erkek"} onChange={(e) => setCandForm({...candForm, gender: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white">
                    <option value="Erkek">Erkek</option>
                    <option value="Kadın">Kadın</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Uyruk *</label>
                  <input required value={candForm.nationality || "Pakistan"} onChange={(e) => setCandForm({...candForm, nationality: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Pasaport Bitiş Tarihi *</label>
                  <input type="date" required value={candForm.passportExpiry ? candForm.passportExpiry.split('T')[0] : ""} onChange={(e) => setCandForm({...candForm, passportExpiry: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Pasaport No *</label>
                  <input required value={candForm.passportNo || ""} onChange={(e) => setCandForm({...candForm, passportNo: e.target.value.replace(/\s/g, "").toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vatandaşlık No (CNIC No)</label>
                  <input value={candForm.cnicNo || ""} onChange={(e) => setCandForm({...candForm, cnicNo: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefon</label>
                  <input value={candForm.phone || ""} onChange={(e) => setCandForm({...candForm, phone: e.target.value.replace(/[^0-9+]/g, "")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Meslek *</label>
                  <input required value={candForm.profession || ""} onChange={(e) => setCandForm({...candForm, profession: toTitleCase(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Acente *</label>
                  <input required value={candForm.agency || ""} onChange={(e) => setCandForm({...candForm, agency: toTitleCase(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Maaş *</label>
                  <input required value={candForm.salary || "33.030,00"} onChange={(e) => setCandForm({...candForm, salary: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Atanacak Şirket *</label>
                  <select required value={candForm.companyId || ""} onChange={(e) => setCandForm({...candForm, companyId: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white">
                    <option value="">Şirket Seçiniz...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Süreç Durumu *</label>
                  <select required value={candForm.status || "Sözleşme Gönderildi"} onChange={(e) => setCandForm({...candForm, status: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white">
                    <option value="Sözleşme Gönderildi">Sözleşme Gönderildi</option>
                    <option value="Giriş bekleniyor">Giriş Bekleniyor (Referanssız)</option>
                    <option value="Bakanlık Sürecinde">Bakanlık Sürecinde</option>
                    <option value="Harç Ödemesi">Harç Ödemesi</option>
                    <option value="Bilet Bekliyor">Bilet Bekliyor (Onaylandı)</option>
                    <option value="Şirkette Çalışıyor">Şirkette Çalışıyor</option>
                    <option value="Bakanlık Tarafından Reddedildi">Bakanlık Tarafından Reddedildi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ek Notlar</label>
                <textarea value={candForm.notes || ""} onChange={(e) => setCandForm({...candForm, notes: e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => requestCancelConfirmation(() => setShowCandidateModal(false))} className="px-5 py-2.5 text-slate-400 hover:text-white cursor-pointer">
                  İptal
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 cursor-pointer">
                  {editingCandidateId ? "Personeli Güncelle" : "Personeli Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ŞİRKET EKLE/DÜZENLE MODAL */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">{editingCompanyId ? "Şirketi Düzenle" : "Yeni Şirket Ekle"}</h2>
                <p className="text-xs text-slate-400">Şirket bilgilerini ve adres detaylarını girin.</p>
              </div>
              <button 
                type="button"
                onClick={() => requestCancelConfirmation(() => setShowCompanyModal(false))} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {compError && <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4 whitespace-nowrap inline-flex items-center">{compError}</div>}
            
            <form onSubmit={handleSaveCompany} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Şirket Adı (Portalda Görünecek Kısa Ad) *</label>
                  <input required value={compForm.name || ""} onChange={(e) => setCompForm({...compForm, name: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600" placeholder="Örn: X YAZILIM" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Resmi Şirket Ünvanı *</label>
                  <input required value={compForm.officialName || ""} onChange={(e) => setCompForm({...compForm, officialName: e.target.value.toLocaleUpperCase("tr-TR")})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600" placeholder="Örn: X YAZILIM TİCARET LİMİTED ŞİRKETİ" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vergi Numarası *</label>
                  <input required value={compForm.taxNumber || ""} onChange={(e) => setCompForm({...compForm, taxNumber: e.target.value.replace(/[^0-9]/g, '')})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" maxLength={10} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Vergi Dairesi *</label>
                  <input required value={compForm.taxOffice || ""} onChange={(e) => setCompForm({...compForm, taxOffice: e.target.value.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ\s]/g, '').toLocaleUpperCase('tr-TR')})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Şirket Merkez Adresi *</label>
                  <textarea required value={compForm.companyAddress || ""} onChange={(e) => setCompForm({...compForm, companyAddress: e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Yabancı Çalışma Adresi *</label>
                  <textarea required value={compForm.workAddress || ""} onChange={(e) => setCompForm({...compForm, workAddress: e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white resize-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Yetkili Kişi *</label>
                  <input required value={compForm.contactName || ""} onChange={(e) => setCompForm({...compForm, contactName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mevkisi / Konumu *</label>
                  <input required placeholder="Örn: İK Müdürü" value={compForm.contactTitle || ""} onChange={(e) => setCompForm({...compForm, contactTitle: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefon *</label>
                  <input required value={compForm.phone || ""} onChange={(e) => setCompForm({...compForm, phone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">E-Posta</label>
                  <input type="email" value={compForm.email || ""} onChange={(e) => setCompForm({...compForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Referans (Yönlendiren)</label>
                  <input value={compForm.referralPerson || ""} onChange={(e) => setCompForm({...compForm, referralPerson: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <span>Ekleme Yapan</span>
                    <Lock className="w-3 h-3 text-slate-500" title="Otomatik doldurulur" />
                  </label>
                  <input disabled value={compForm.createdByName || (typeof currentUserDisplayName !== "undefined" ? currentUserDisplayName : "Yönetici")} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-400 text-xs cursor-not-allowed" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notlar</label>
                <textarea value={compForm.notes || ""} onChange={(e) => setCompForm({...compForm, notes: e.target.value})} rows={2} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white resize-none" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => requestCancelConfirmation(() => setShowCompanyModal(false))} className="px-5 py-2.5 text-slate-400 hover:text-white cursor-pointer">
                  İptal
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-7 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-600/20 cursor-pointer">
                  {editingCompanyId ? "Güncelle" : "Şirketi Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TALEP EKLE/DÜZENLE MODAL */}
      {showDemandModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) =>e.stopPropagation()}
            className="relative w-full max-w-2xl transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">{editingDemandId ? "Talebi Düzenle" : "Yeni İşçi Talebi Ekle"}</h2>
                <p className="text-xs text-slate-400">Şirket için gerekli meslek ve kişi sayısını girin.</p>
              </div>
              <button 
                type="button"
                onClick={() =>requestCancelConfirmation(() =>setShowDemandModal(false))} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {demandError && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl mb-5 whitespace-nowrap inline-flex items-center">{demandError}</div>}
            
            <form noValidate onSubmit={async (e) =>{
              e.preventDefault();
              setDemandError("");

              // --- MÜKERRER ŞİRKET KONTROLÜ ---
              const isDuplicateCompany = demandsList.find(
                (d) =>(d.companyName || "").trim().toLocaleUpperCase("tr-TR") === (demandForm.companyName || "").trim().toLocaleUpperCase("tr-TR") && d.id !== editingDemandId
              );

              if (isDuplicateCompany && !editingDemandId && !demandDuplicateConfirm) {
                setDemandError("⚠️ Uyarı: Bu isimde bir şirket için zaten açık bir talep mevcut. Bu isimle yeni bir talep oluşturmak istiyorsanız alttaki turuncu butona tıklayın.");
                setDemandDuplicateConfirm(true);
                return;
              }
              // --- MÜKERRER ŞİRKET KONTROLÜ ---
              

              // --- 1. ZORUNLU ALAN KONTROLLERİ ---
              if (!demandForm.companyName || demandForm.companyName.trim() === "") {
                setDemandError("Lütfen Şirket Adı alanını doldurun.");
                return;
              }
              
              const pList = demandForm.professions ? demandForm.professions.split(' | ') : [];
              const isValidProf = pList.some(p =>{
                const pts = p.split(':');
                return pts[0] && pts[0].trim() !== "" && pts[1] && Number(pts[1]) > 0;
              });

              if (!isValidProf) {
                setDemandError("Lütfen en az bir adet meslek adı ve geçerli bir kişi sayısı girin.");
                return;
              }

              if (!demandForm.cityName || demandForm.cityName.trim() === "") {
                setDemandError("Lütfen Talep Edilen Şehrin Adı alanını doldurun.");
                return;
              }
              if (!demandForm.requesterName || demandForm.requesterName.trim() === "") {
                setDemandError("Lütfen Talep Eden Kişinin Adı alanını doldurun.");
                return;
              }
              if (!demandForm.requesterPhone || demandForm.requesterPhone.trim().length !== 11) {
                setDemandError("Telefon numarası tam olarak 11 haneli olmalıdır (Örn: 05551234567).");
                return;
              }

              // --- 2. MÜKERRER ŞİRKET KONTROLÜ ---
              

              // --- 3. KAYIT İŞLEMİ ---
              const isEdit = !!editingDemandId;
              const endpoint = isEdit ? `/api/demands/${editingDemandId}` : "/api/demands";
              const method = isEdit ? "PUT" : "POST";

              try {
                const res = await fetch(endpoint, {
                  method,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...demandForm,
                    companyName: demandForm.companyName.trim().toLocaleUpperCase("tr-TR")
                  })
    });

                if (res.ok) {
                  setShowDemandModal(false);
                  setEditingDemandId(null);
                  setDemandForm(initialDemandForm);
                  fetchData();
                } else {
                  const errText = await res.text();
                  try {
                    const errObj = JSON.parse(errText);
                    setDemandError(errObj.error || "Kayıt Başarısız (Sunucu Hatası).");
                  } catch (parseErr) {
                    const match = errText.match(/<title[^>]*>([^<]+)<\/title>/i);
                    const title = match ? match[1] : errText.substring(0, 100);
                    setDemandError("Sunucu Hatası (Backend): " + title);
                    console.error("Backend Yanıtı:", errText);
                  }
                }
              } catch (err) {
                setDemandError("Kritik Form Hatası: " + err.message);
                console.error("Fetch Hatası:", err);
              }
            }} className="space-y-5 text-sm">

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Şirket Adı *</label>
                <input 
                  value={demandForm.companyName || ""} 
                  onChange={(e) =>setDemandForm({...demandForm, companyName: e.target.value.toLocaleUpperCase("tr-TR")})} 
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-white transition-all outline-none" 
                  placeholder="Örn: ÖRNEK İNŞAAT" 
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Talep Edilen Meslekler ve Kişi Sayıları *</label>
                <div className="space-y-3">
                  {(demandForm.professions ? demandForm.professions.split(' | ') : [":"]).map((item, index) =>{
                    const parts = item.split(':');
                    const name = parts[0] || "";
                    const count = parts[1] || "";
                    return (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl flex items-center overflow-hidden focus-within:border-blue-500 transition-all shadow-sm">
                          <input
                            value={name}
                            onChange={(e) =>{
                              const currentItems = demandForm.professions ? demandForm.professions.split(' | ') : [":"];
                              const currentParts = (currentItems[index] || ":").split(':');
                              currentParts[0] = e.target.value;
                              currentItems[index] = currentParts.join(':');
                              setDemandForm({...demandForm, professions: currentItems.join(' | ')});
                            }}
                            className="flex-1 bg-transparent p-3 text-white focus:outline-none text-sm placeholder-slate-600"
                            placeholder="Meslek (Örn: Kaynakçı)"
                          />
                          <div className="w-px h-6 bg-slate-800"></div>
                          <input
                            type="number"
                            min="1"
                            value={count}
                            onChange={(e) =>{
                              const currentItems = demandForm.professions ? demandForm.professions.split(' | ') : [":"];
                              const currentParts = (currentItems[index] || ":").split(':');
                              currentParts[1] = e.target.value;
                              currentItems[index] = currentParts.join(':');
                              
                              let total = 0;
                              currentItems.forEach(i =>{
                                const c = parseInt((i.split(':')[1] || "0"), 10);
                                if (!isNaN(c)) total += c;
                              });
                              
                              setDemandForm({
                                ...demandForm, 
                                professions: currentItems.join(' | '),
                                headCount: total.toString()
                              });
                            }}
                            className="w-24 bg-transparent p-3 text-white focus:outline-none text-sm font-mono text-center placeholder-slate-600"
                            placeholder="Sayı"
                          />
                        </div>
                        {(demandForm.professions ? demandForm.professions.split(' | ') : [":"]).length > 1 && (
                          <button
                            type="button"
                            onClick={() =>{
                              const currentItems = demandForm.professions.split(' | ').filter((_, i) =>i !== index);
                              let total = 0;
                              currentItems.forEach(i =>{
                                const c = parseInt((i.split(':')[1] || "0"), 10);
                                if (!isNaN(c)) total += c;
                              });
                              setDemandForm({...demandForm, professions: currentItems.join(' | '), headCount: total.toString()});
                            }}
                            className="p-3 bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 text-slate-500 hover:text-red-400 rounded-xl transition-all whitespace-nowrap inline-flex items-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() =>{
                      const current = demandForm.professions ? demandForm.professions : "";
                      setDemandForm({...demandForm, professions: current + (current ? ' | ' : '') + ":"});
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 mt-2 border border-dashed border-slate-700 hover:border-blue-500 hover:bg-blue-500/10 rounded-xl text-slate-400 hover:text-blue-400 transition-all text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" /> Yeni Meslek Satırı Ekle
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Toplam Kişi Sayısı</label>
                  <input type="number" readOnly value={demandForm.headCount || "0"} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-blue-400 font-mono font-bold opacity-70 cursor-not-allowed outline-none" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Talep Edilen Şehrin Adı *</label>
                  <input value={demandForm.cityName || ""} onChange={(e) =>setDemandForm({...demandForm, cityName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-white transition-all outline-none" placeholder="Örn: Ankara" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Talep Eden Kişinin Adı *</label>
                  <input value={demandForm.requesterName || ""} onChange={(e) =>setDemandForm({...demandForm, requesterName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl p-3 text-white transition-all outline-none" placeholder="Ad Soyad" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Talep Eden Kişinin Telefon No *</label>
                  <input 
                    maxLength={11} 
                    value={demandForm.requesterPhone || ""} 
                    onChange={(e) =>setDemandForm({...demandForm, requesterPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                    className={`w-full bg-slate-950 border rounded-xl p-3 text-white font-mono transition-all ${
                      demandForm.requesterPhone && demandForm.requesterPhone.length > 0 && demandForm.requesterPhone.length < 11
                        ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] focus:border-red-500 focus:outline-none"
                        : "border-slate-800 focus:border-blue-500 focus:outline-none"
                    }`} 
                    placeholder="Örn: 05551234567 (11 Rakam)" 
                  />
                  {demandForm.requesterPhone && demandForm.requesterPhone.length > 0 && demandForm.requesterPhone.length < 11 && (
                    <span className="text-[11px] text-red-400 mt-1.5 block font-medium">
                      Tam 11 haneli sayı olmalıdır. (Girdiğiniz: {demandForm.requesterPhone.length} hane)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() =>requestCancelConfirmation(() =>setShowDemandModal(false))} 
                  className="px-5 py-2.5 text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  İptal
                </button>
                <button 
                  type="submit" 
                  className={`px-7 py-2.5 rounded-xl font-medium shadow-lg cursor-pointer transition-all ${
                    demandDuplicateConfirm 
                      ? "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20" 
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                  }`}>
                  {demandDuplicateConfirm ? "⚠️ Evet, Yine de Yeni Talep Oluştur" : (editingDemandId ? "Talebi Güncelle" : "Talebi Kaydet")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      
      {/* TALEP DETAY MODALI */}
      {selectedDemandDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) =>e.stopPropagation()}
            className="relative w-full max-w-lg transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">Talep Detayları</h2>
                <p className="text-xs text-slate-400">Şirket işçi talebi bilgileri.</p>
              </div>
              <button 
                type="button"
                onClick={() =>setSelectedDemandDetail(d)} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <div>
                  <span className="text-xs text-slate-500 block">Şirket Adı</span>
                  <span className="text-white font-bold text-base whitespace-nowrap inline-flex items-center">{selectedDemandDetail.companyName}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-xs text-slate-500 block">Talep Edilen Şehir</span>
                    <span className="text-slate-200 font-medium">{selectedDemandDetail.cityName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Toplam Kişi Sayısı</span>
                    <span className="text-blue-400 font-mono font-bold">{selectedDemandDetail.headCount} Kişi</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-2">Talep Edilen Meslekler</span>
                <div className="space-y-1.5">
                  {(selectedDemandDetail.professions || "").split(' | ').map((item: string, idx: number) =>{
                    const [pName, pCount] = item.split(':');
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                        <span className="text-slate-200 font-medium">{pName || "-"}</span>
                        <span className="text-blue-400 font-mono font-bold">{pCount || "0"} Kişi</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500 block">Talep Eden Kişi</span>
                    <span className="text-slate-200 font-medium">{selectedDemandDetail.requesterName}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Telefon Numarası</span>
                    <span className="text-slate-200 font-mono">{selectedDemandDetail.requesterPhone || "-"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                  <div>
                    <span className="text-xs text-slate-500 block">Kaydı Açan</span>
                    <span className="text-slate-300 text-xs">{selectedDemandDetail.createdByName || "Sistem"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Talep Tarihi</span>
                    <span className="text-amber-400 font-mono text-xs">{selectedDemandDetail.createdAt ? new Date(selectedDemandDetail.createdAt).toLocaleString("tr-TR") : "-"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-5 border-t border-slate-800 mt-6">
              <button 
                onClick={() =>setSelectedDemandDetail(d)} 
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl font-medium cursor-pointer transition-all text-xs"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}


      {/* KULLANICI EKLE/DÜZENLE MODAL */}
      {showUserModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) =>e.stopPropagation()}
            className="relative w-full max-w-md transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">{editingUserId ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı Ekle"}</h2>
                <p className="text-xs text-slate-400">Giriş yetkisi, takma ad ve rolü belirleyin.</p>
              </div>
              <button 
                type="button"
                onClick={() =>requestCancelConfirmation(() =>setShowUserModal(false))} 
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userError && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4 whitespace-nowrap inline-flex items-center">{userError}</div>}
            
            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ad Soyad *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input required value={userForm.name || ""} onChange={(e) =>setUserForm({...userForm, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-white" placeholder="Ahmet Yılmaz" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Takma Ad (Nickname / Kod)</label>
                <div className="relative">
                  <BadgeCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input value={userForm.nickname || ""} onChange={(e) =>setUserForm({...userForm, nickname: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-white font-mono" placeholder="ahmety (İşlemlerde görünecek)" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">E-Posta *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="email" required value={userForm.email || ""} onChange={(e) =>setUserForm({...userForm, email: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-white" placeholder="ahmet@portal.com" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {editingUserId ? "Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)" : "Şifre *"}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="password" required={!editingUserId} value={userForm.password || ""} onChange={(e) =>setUserForm({...userForm, password: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-white" placeholder="••••••••" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Yetki Rolü *</label>
                <select value={userForm.role || ""} onChange={(e) =>setUserForm({...userForm, role: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                  <option value="VIEWER">Görüntüleyici (Sadece Arama ve İnceleme)</option>
                  <option value="MANAGER">Yönetici (Personel & Şirket Ekleme/Düzenleme)</option>
                  <option value="SUPER_ADMIN">Süper Admin (Tam Yetki + Kullanıcı Yönetimi)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() =>requestCancelConfirmation(() =>setShowUserModal(false))} 
                  className="px-4 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  İptal
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-medium shadow-lg shadow-blue-600/20 cursor-pointer">
                  {editingUserId ? "Güncelle" : "Kullanıcı Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BAKANLIK DURUMU HIZLI MODAL */}
      {ministryCandidate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div 
            onClick={(e) =>e.stopPropagation()}
            className="relative w-full max-w-2xl transform rounded-3xl bg-slate-900 p-6 sm:p-8 text-left shadow-2xl border border-slate-800 my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 whitespace-nowrap inline-flex items-center">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Bakanlık Durumu Girişi</h2>
                  <p className="text-xs text-slate-400">#prs{ministryCandidate.registrationNo} • {ministryCandidate.firstName} {ministryCandidate.lastName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) =>{
                    e.stopPropagation();
                    handleSaveMinistry(null, true);
                  }}
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                  title="Bakanlık Verilerini Temizle"
                >
                  <Eraser className="w-4 h-4" />
                  <span>Verileri Temizle</span>
                </button>

                <button 
                  type="button"
                  onClick={() =>requestCancelConfirmation(() =>setMinistryCandidate(null))} 
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {ministryError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4 whitespace-nowrap inline-flex items-center">
                {ministryError}
              </div>
            )}

            <form onSubmit={(e) =>handleSaveMinistry(e, false)} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Referans Numarası *
                  </label>
                  <input 
                    required
                    placeholder="2026-asswq210-2708" 
                    value={ministryForm.refNumber || ""} 
                    onChange={(e) =>handleMinistryRefChange(e.target.value)} 
                    onBlur={() =>setMinistryRefTouched(true)}
                    className={`w-full bg-slate-950 border rounded-xl p-3 text-white font-mono transition-all ${
                      shouldShowRefError(ministryForm.refNumber, ministryRefTouched)
                        ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] focus:border-red-500 focus:outline-none"
                        : "border-slate-700 focus:border-blue-500 focus:outline-none"
                    }`}
                  />
                  {shouldShowRefError(ministryForm.refNumber, ministryRefTouched) ? (
                    <span className="text-[11px] text-red-400 mt-1 block font-medium">
                      Format hatalı veya eksik! (Örn: 2026-asswq210-2708)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 mt-1 block">Tarih otomatik hesaplanır.</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                    Referans Son Günü (30 Gün) *
                    {ministryForm.refExpiryDate && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
                  </label>
                  <input 
                    type="date"
                    required
                    value={ministryForm.refExpiryDate || ""} 
                    onChange={(e) =>setMinistryForm({...ministryForm, refExpiryDate: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Başvuru Numarası
                  </label>
                  <input 
                    maxLength={7}
                    disabled={!ministryForm.refNumber || ministryForm.refNumber.trim() === ""}
                    placeholder={ministryForm.refNumber && ministryForm.refNumber.trim() !== "" ? "Örn: 4322122" : "Önce Ref Numarası Girilmelidir!"} 
                    value={ministryForm.refNumber && ministryForm.refNumber.trim() !== "" ? (ministryForm.appNumber || "") : ""} 
                    onChange={(e) =>{
                      if (!ministryForm.refNumber || ministryForm.refNumber.trim() === "") return;
                      const val = e.target.value;
                      const todayStr = new Date().toLocaleDateString('en-CA');
                      setMinistryForm(prev =>({
                        ...prev,
                        appNumber: val,
                        appDate: val.length > 0 ? (prev.appDate || todayStr) : ""
                      }));
                    }} 
                    className={`w-full bg-slate-900 border rounded-xl p-3 text-white font-mono transition-all ${!ministryForm.refNumber || ministryForm.refNumber.trim() === "" ? "opacity-40 cursor-not-allowed bg-slate-950 text-slate-600" : ""} ${
                      ministryForm.appNumber && ministryForm.appNumber.length === 7 && !APP_REGEX.test(ministryForm.appNumber)
                        ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] focus:border-red-500 focus:outline-none"
                        : "border-slate-700 focus:border-blue-500 focus:outline-none"
                    }`}
                  />
                  {ministryForm.appNumber && !APP_REGEX.test(ministryForm.appNumber) && (
                    <span className="text-[11px] text-red-400 mt-1 block font-medium">
                      Tam 7 haneli sayı olmalıdır.
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Başvuru Tarihi</label>
                  <input 
                    type="date"
                    value={ministryForm.appDate || ""} 
                    onChange={(e) =>setMinistryForm({...ministryForm, appDate: e.target.value})} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Başvuru Durumu</label>
                  <select 
                    value={ministryForm.appStatus || ""} 
                    onChange={(e) =>setMinistryForm({...ministryForm, appStatus: e.target.value})} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-medium" 
                  >
                    <option value="Beklemede">Beklemede</option>
                    <option value="Harç Ödemesi">Harç Ödemesi</option>
                    <option value="Onaylandı">Onaylandı</option>
                    <option value="Reddedildi">Reddedildi</option>
                  </select>
                </div>
              </div>

              {(ministryForm.appStatus === "Harç Ödemesi" || ministryForm.foreignIdNo) && (
                <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Yabancı Kimlik Numarası (YKN - 11 Hane)
                    </label>
                    <input 
                      maxLength={11}
                      placeholder="Örn: 99123456789" 
                      value={ministryForm.foreignIdNo || ""} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setMinistryForm(prev => {
                          let newFeeDate = prev.feeDate || "";
                          let newFeeExpiry = prev.feeExpiryDate || "";
                          
                          if (val.length > 0 && !prev.feeDate) {
                            const d = new Date();
                            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                            newFeeDate = d.toISOString().split("T")[0];
                            
                            const exp = new Date(d);
                            exp.setDate(exp.getDate() + 30);
                            newFeeExpiry = exp.toISOString().split("T")[0];
                          } else if (val.length === 0) {
                            newFeeDate = "";
                            newFeeExpiry = "";
                          }
                          
                          return { ...prev, foreignIdNo: val, feeDate: newFeeDate, feeExpiryDate: newFeeExpiry };
                        });
                      }} 
                      className={`w-full bg-slate-950 border rounded-xl p-3 text-white font-mono text-sm tracking-wider transition-all ${
                        ministryForm.foreignIdNo && !FOREIGN_ID_REGEX.test(ministryForm.foreignIdNo)
                          ? "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] focus:border-red-500 focus:outline-none"
                          : "border-emerald-500/40 focus:border-emerald-400 focus:outline-none"
                      }`}
                    />
                    {ministryForm.foreignIdNo && !FOREIGN_ID_REGEX.test(ministryForm.foreignIdNo) && (
                      <span className="text-[11px] text-red-400 block font-medium mt-1">
                        Yabancı Kimlik Numarası tam 11 haneli bir sayı olmalıdır!
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-emerald-500/20 pt-4">
                    <div>
                      <label className="block text-xs font-medium text-emerald-300/80 mb-1">Harç Ödemesi Geldiği Gün</label>
                      <input type="date" value={ministryForm.feeDate || ""} onChange={(e) => setMinistryForm(prev => ({...prev, feeDate: e.target.value}))} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-emerald-300/80 mb-1">Harç Ödemesi Biteceği Gün</label>
                      <input type="date" value={ministryForm.feeExpiryDate || ""} onChange={(e) => setMinistryForm(prev => ({...prev, feeExpiryDate: e.target.value}))} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-white focus:border-emerald-500 focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() =>requestCancelConfirmation(() =>setMinistryCandidate(null))} 
                  className="px-5 py-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  İptal
                </button>
                <button type="submit" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-red-600/20 cursor-pointer">
                  Bakanlık Durumunu Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÖZEL ŞIK İPTAL / ONAY PENCERESİ */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[999] animate-in fade-in duration-150">
          <div className="bg-slate-900/95 border border-slate-700/80 rounded-3xl max-w-md w-full p-7 space-y-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] text-center zoom-in-95 duration-150">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)] whitespace-nowrap">
              <HelpCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white tracking-tight">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() =>setConfirmDialog((prev) =>({ ...prev, isOpen: false }))}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer border border-slate-700"
              >
                Vazgeç / Devam Et
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                Evet, Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}