import { create } from "zustand";

type RegisterStep = 1 | 2 | 3;

interface VerificationData {
  name: string;
  phone: string;
}

interface RegisterState {
  step: RegisterStep;
  verification: VerificationData | null;
  setStep: (step: RegisterStep) => void;
  setVerification: (data: VerificationData) => void;
  reset: () => void;
}

export const useRegisterStore = create<RegisterState>((set) => ({
  step: 1,
  verification: null,
  setStep: (step) => set({ step }),
  setVerification: (verification) => set({ verification }),
  reset: () => set({ step: 1, verification: null }),
}));
