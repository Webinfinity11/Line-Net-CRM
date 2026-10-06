export const COMPANY_FIELDS = {
 company_name: "კომპანიის სახელი", company_id_code: "საიდენტიფიკაციო კოდი", company_address: "მისამართი", company_phone: "ტელეფონი", company_email: "ელფოსტა", company_bank: "ბანკი", company_iban: "საბანკო ანგარიში",
};
export type CompanySettings = Record<keyof typeof COMPANY_FIELDS, string>;
