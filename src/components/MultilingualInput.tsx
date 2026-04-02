import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MultilingualInputProps {
  label: string;
  values: { en: string; ku: string; ar: string };
  onChange: (vals: { en: string; ku: string; ar: string }) => void;
  multiline?: boolean;
}

export function MultilingualInput({ label, values, onChange, multiline = false }: MultilingualInputProps) {
  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Tabs defaultValue="en" className="w-full">
        <TabsList className="h-8">
          <TabsTrigger value="en" className="text-xs px-3 py-1">EN</TabsTrigger>
          <TabsTrigger value="ku" className="text-xs px-3 py-1">KU</TabsTrigger>
          <TabsTrigger value="ar" className="text-xs px-3 py-1">AR</TabsTrigger>
        </TabsList>
        <TabsContent value="en">
          <Field value={values.en} onChange={(e) => onChange({ ...values, en: e.target.value })} placeholder={`${label} (English)`} />
        </TabsContent>
        <TabsContent value="ku">
          <Field value={values.ku} onChange={(e) => onChange({ ...values, ku: e.target.value })} placeholder={`${label} (Kurdish)`} dir="rtl" />
        </TabsContent>
        <TabsContent value="ar">
          <Field value={values.ar} onChange={(e) => onChange({ ...values, ar: e.target.value })} placeholder={`${label} (Arabic)`} dir="rtl" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
