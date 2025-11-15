import { FC } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Tier = "Platinum" | "Gold" | "Silver";

interface Props {
  name: string;
  membershipNo: string;
  expiryLabel: string; // e.g., "Jan 2026"
  tier: Tier;
  photoUrl?: string | null;
  contactEmail?: string;
}

const themeForTier = (tier: Tier) => {
  switch (tier) {
    case "Platinum":
      return {
        accent: "from-[#d7dce2] to-[#bfc6cf]",
        badge: "bg-[#dfe5ec] text-[#0f172a]",
        dotOpacity: "opacity-15",
      };
    case "Gold":
      return {
        accent: "from-[#f1c859] to-[#d8ab3a]",
        badge: "bg-[#f6e3a8] text-[#2b2b2b]",
        dotOpacity: "opacity-15",
      };
    case "Silver":
    default:
      return {
        accent: "from-[#cfd6de] to-[#b7c1cc]",
        badge: "bg-[#e9edf2] text-[#0f172a]",
        dotOpacity: "opacity-10",
      };
  }
};

// shared matte card base
const baseCard = cn(
  "relative rounded-xl border overflow-hidden",
  "bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.04),transparent_35%),linear-gradient(135deg,#0b0c0f,#0e1115,#12151a)]",
  "border-[#2a2d33]"
);

const Face: FC<Props & { side: "front" | "back" }> = ({ side, name, membershipNo, expiryLabel, tier, photoUrl, contactEmail = "lostcard@yourcompany.com" }) => {
  const t = themeForTier(tier);
  return (
    <div className={cn(baseCard, "h-48 w-[420px]")}> 
      {/* accent stripe */}
      <div className={cn("absolute left-0 top-0 h-full w-3 bg-gradient-to-b", t.accent)} />
      {/* soft gloss band */}
      <div className="absolute -top-10 right-10 h-[180%] w-1/2 rotate-[18deg] bg-gradient-to-b from-white/8 via-transparent to-transparent" />
      {/* subtle dots */}
      <div className={cn("absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:6px_6px]", t.dotOpacity)} />

      {side === "front" ? (
        <div className="relative z-10 flex flex-col h-full p-5">
          {/* header */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/favicon.ico" alt="Logo" className="h-6 w-6 rounded-sm" />
              <span className="text-xs text-gray-300">YOURLOGO</span>
            </div>
            <span className="text-xs tracking-wider text-gray-300">MEMBERSHIP CARD</span>
          </div>
          {/* main */}
          <div className="mt-4 flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-gray-300/70 shadow-md rounded-full">
              <AvatarImage src={photoUrl || undefined} />
              <AvatarFallback className="text-xs text-gray-400">PHOTO</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="text-white font-semibold tracking-tight">{name}</div>
              <div className="text-xs text-gray-300">Membership No: {membershipNo}</div>
              <div className="text-xs text-gray-400">Position: {expiryLabel}</div>
              <div className={cn("mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold", t.badge)}>{tier}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 h-full p-5">
          <div className="h-8 bg-black/80 rounded-sm mb-3" />
          <div className="flex items-start justify-between">
            <div className="w-28 h-28 bg-white rounded-md border border-black/10 grid place-items-center">
              <span className="text-[10px] text-black/80 text-center px-1">QR CODE (profile data)</span>
            </div>
            <div className="text-[11px] text-gray-300 text-right">
              <div>{membershipNo}</div>
              <div>If found, contact: {contactEmail}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Thumb: FC<{ tier: Tier }> = ({ tier }) => {
  const t = themeForTier(tier);
  return (
    <div className={cn(baseCard, "h-24 w-40")}> 
      <div className={cn("absolute left-0 top-0 h-full w-2 bg-gradient-to-b", t.accent)} />
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:6px_6px] opacity-10" />
      <div className={cn("absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px]", t.badge)}>{tier}</div>
    </div>
  );
};

const IdCardShowcase: FC<Props> = (props) => {
  const { tier } = props;
  return (
    <div className="space-y-6">
      {/* side-by-side front/back on reflective surface */}
      <div className="relative w-full flex items-end gap-6 justify-center">
        <Face side="front" {...props} />
        <Face side="back" {...props} />
        {/* reflection plate */}
        <div className="absolute -bottom-8 left-0 right-0 h-24 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_60%)] blur-[1px]" />
      </div>

      {/* thumbnails for other tiers */}
      <div className="flex items-center justify-center gap-4">
        <Thumb tier="Gold" />
        <Thumb tier="Silver" />
        {/* current tier as label */}
        <span className="text-xs text-muted-foreground">Showing: {tier}</span>
      </div>
    </div>
  );
};

export default IdCardShowcase;