import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const translations: Record<string, Record<Language, string>> = {
  // Nav
  'nav.reception': { en: 'Reception', ar: 'الاستقبال' },
  'nav.patients': { en: 'Patients', ar: 'المرضى' },
  'nav.doctorQueue': { en: 'Doctor Queue', ar: 'قائمة الطبيب' },
  'nav.admin': { en: 'Admin Panel', ar: 'لوحة الإدارة' },
  'nav.logout': { en: 'Logout', ar: 'تسجيل الخروج' },

  // Auth
  'auth.login': { en: 'Sign In', ar: 'تسجيل الدخول' },
  'auth.email': { en: 'Email', ar: 'البريد الإلكتروني' },
  'auth.password': { en: 'Password', ar: 'كلمة المرور' },
  'auth.signingIn': { en: 'Signing in...', ar: 'جاري تسجيل الدخول...' },
  'auth.welcome': { en: 'Dental Clinic Management', ar: 'إدارة عيادة الأسنان' },
  'auth.subtitle': { en: 'Sign in to your account', ar: 'سجل دخولك إلى حسابك' },

  // Reception
  'reception.title': { en: 'Reception Dashboard', ar: 'لوحة الاستقبال' },
  'reception.search': { en: 'Search by name or phone...', ar: 'بحث بالاسم أو الهاتف...' },
  'reception.newAppointment': { en: 'New Appointment', ar: 'موعد جديد' },
  'reception.patient': { en: 'Patient', ar: 'المريض' },
  'reception.phone': { en: 'Phone', ar: 'الهاتف' },
  'reception.doctor': { en: 'Doctor', ar: 'الطبيب' },
  'reception.time': { en: 'Time', ar: 'الوقت' },
  'reception.treatments': { en: 'Treatments', ar: 'العلاجات' },
  'reception.paid': { en: 'Paid', ar: 'المدفوع' },
  'reception.remaining': { en: 'Remaining', ar: 'المتبقي' },
  'reception.status': { en: 'Status', ar: 'الحالة' },
  'reception.actions': { en: 'Actions', ar: 'الإجراءات' },
  'reception.noAppointments': { en: 'No appointments found', ar: 'لا توجد مواعيد' },
  'reception.sendToDoctor': { en: 'Send to Doctor', ar: 'إرسال للطبيب' },
  'reception.payment': { en: 'Payment', ar: 'الدفع' },
  'reception.existingPatientFound': { en: 'Existing patient found', ar: 'تم العثور على مريض مسجل' },
  'reception.newPatient': { en: 'New patient — enter details', ar: 'مريض جديد — أدخل البيانات' },
  'reception.lastVisit': { en: 'Last visit', ar: 'آخر زيارة' },

  // Patients
  'patients.title': { en: 'Patient Management', ar: 'إدارة المرضى' },
  'patients.addPatient': { en: 'Add Patient', ar: 'إضافة مريض' },
  'patients.editPatient': { en: 'Edit Patient', ar: 'تعديل المريض' },
  'patients.name': { en: 'Name', ar: 'الاسم' },
  'patients.phone': { en: 'Phone', ar: 'الهاتف' },
  'patients.age': { en: 'Age', ar: 'العمر' },
  'patients.notes': { en: 'Notes', ar: 'ملاحظات' },
  'patients.search': { en: 'Search patients...', ar: 'بحث عن مريض...' },
  'patients.viewProfile': { en: 'View Profile', ar: 'عرض الملف' },
  'patients.noPatients': { en: 'No patients found', ar: 'لا يوجد مرضى' },

  // Doctor
  'doctor.queue': { en: 'My Queue', ar: 'قائمة المرضى' },
  'doctor.noPatients': { en: 'No patients in queue', ar: 'لا يوجد مرضى في القائمة' },
  'doctor.startVisit': { en: 'Start Visit', ar: 'بدء الزيارة' },
  'doctor.visit': { en: 'Visit', ar: 'الزيارة' },
  'doctor.patientInfo': { en: 'Patient Info', ar: 'معلومات المريض' },
  'doctor.treatmentPlan': { en: 'Treatment Plan', ar: 'خطة العلاج' },
  'doctor.images': { en: 'Treatment Images', ar: 'صور العلاج' },
  'doctor.notes': { en: 'Doctor Notes', ar: 'ملاحظات الطبيب' },
  'doctor.addTreatment': { en: 'Add Treatment', ar: 'إضافة علاج' },
  'doctor.completeVisit': { en: 'Complete Visit', ar: 'إنهاء الزيارة' },
  'doctor.treatment': { en: 'Treatment', ar: 'العلاج' },
  'doctor.price': { en: 'Price', ar: 'السعر' },
  'doctor.discount': { en: 'Discount', ar: 'الخصم' },
  'doctor.total': { en: 'Total', ar: 'الإجمالي' },
  'doctor.uploadImage': { en: 'Upload Image', ar: 'رفع صورة' },
  'doctor.saveNotes': { en: 'Save Notes', ar: 'حفظ الملاحظات' },

  // Admin
  'admin.title': { en: 'Admin Panel', ar: 'لوحة الإدارة' },
  'admin.doctors': { en: 'Doctors', ar: 'الأطباء' },
  'admin.receptionists': { en: 'Receptionists', ar: 'موظفي الاستقبال' },
  'admin.treatments': { en: 'Treatments', ar: 'العلاجات' },
  'admin.addDoctor': { en: 'Add Doctor', ar: 'إضافة طبيب' },
  'admin.addReceptionist': { en: 'Add Receptionist', ar: 'إضافة موظف استقبال' },
  'admin.addTreatment': { en: 'Add Treatment', ar: 'إضافة علاج' },
  'admin.editTreatment': { en: 'Edit Treatment', ar: 'تعديل العلاج' },
  'admin.treatmentName': { en: 'Treatment Name', ar: 'اسم العلاج' },
  'admin.price': { en: 'Price', ar: 'السعر' },

  // Payment
  'payment.title': { en: 'Payment', ar: 'الدفع' },
  'payment.addPayment': { en: 'Add Payment', ar: 'إضافة دفعة' },
  'payment.addDiscount': { en: 'Add Discount', ar: 'إضافة خصم' },
  'payment.history': { en: 'Payment History', ar: 'سجل المدفوعات' },
  'payment.amount': { en: 'Amount', ar: 'المبلغ' },
  'payment.date': { en: 'Date', ar: 'التاريخ' },
  'payment.totalBilled': { en: 'Total Billed', ar: 'إجمالي الفاتورة' },
  'payment.totalPaid': { en: 'Total Paid', ar: 'إجمالي المدفوع' },
  'payment.balance': { en: 'Balance', ar: 'الرصيد المتبقي' },

  // Common
  'common.save': { en: 'Save', ar: 'حفظ' },
  'common.cancel': { en: 'Cancel', ar: 'إلغاء' },
  'common.delete': { en: 'Delete', ar: 'حذف' },
  'common.edit': { en: 'Edit', ar: 'تعديل' },
  'common.add': { en: 'Add', ar: 'إضافة' },
  'common.close': { en: 'Close', ar: 'إغلاق' },
  'common.loading': { en: 'Loading...', ar: 'جاري التحميل...' },
  'common.noData': { en: 'No data', ar: 'لا توجد بيانات' },
  'common.select': { en: 'Select', ar: 'اختر' },

  // Statuses
  'status.Booked': { en: 'Booked', ar: 'محجوز' },
  'status.Waiting': { en: 'Waiting', ar: 'في الانتظار' },
  'status.WithDoctor': { en: 'With Doctor', ar: 'مع الطبيب' },
  'status.Completed': { en: 'Completed', ar: 'مكتمل' },
  'status.Cancelled': { en: 'Cancelled', ar: 'ملغي' },

  // Reports
  'nav.reports': { en: 'Reports', ar: 'التقارير' },
  'report.dailyRevenue': { en: 'Daily Revenue', ar: 'الإيرادات اليومية' },
  'report.monthlyRevenue': { en: 'Monthly Revenue', ar: 'الإيرادات الشهرية' },
  'report.doctorPerformance': { en: 'Doctor Performance', ar: 'أداء الأطباء' },
  'report.commonTreatments': { en: 'Popular Treatments', ar: 'العلاجات الأكثر شيوعاً' },
  'report.outstandingBalances': { en: 'Outstanding Balances', ar: 'الأرصدة المستحقة' },
  'report.usageCount': { en: 'Usage Count', ar: 'عدد الاستخدامات' },
  'report.revenue': { en: 'Revenue', ar: 'الإيرادات' },

  // License
  'license.expired': { en: 'License Expired', ar: 'انتهت صلاحية الترخيص' },
  'license.expiredDesc': { en: 'Your clinic license has expired. Please contact support to renew.', ar: 'انتهت صلاحية ترخيص عيادتك. يرجى التواصل مع الدعم للتجديد.' },
  'license.expiringSoon': { en: 'License Expiring Soon', ar: 'الترخيص على وشك الانتهاء' },
  'license.expiringSoonDesc': { en: 'Your license will expire on', ar: 'سينتهي ترخيصك في' },

  // Admin extras
  'admin.auditLogs': { en: 'Audit Logs', ar: 'سجل العمليات' },
  'admin.action': { en: 'Action', ar: 'الإجراء' },
  'admin.entityType': { en: 'Entity', ar: 'الكيان' },
  'admin.backup': { en: 'Backup', ar: 'النسخ الاحتياطي' },
  'admin.downloadBackup': { en: 'Download Backup', ar: 'تحميل النسخة الاحتياطية' },
  'admin.backupDesc': { en: 'Download a full backup of your clinic data as JSON.', ar: 'تحميل نسخة احتياطية كاملة من بيانات عيادتك بصيغة JSON.' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'en';
  });

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
