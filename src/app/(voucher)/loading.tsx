import { Spinner } from "@/components/ui/spinner";

export default function VoucherLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size={32} className="text-primary" />
        <p className="text-[15px] text-muted-foreground">로딩 중...</p>
      </div>
    </div>
  );
}
