import { forwardRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeProfileQR } from "@/lib/qr";

interface IdCardMockupProps {
  name: string;
  membershipNo: string;
  expiryLabel: string;
  tier: string; // e.g., Platinum, Gold, Standard
  role?: string;
  photoUrl?: string | null;
  contactEmail?: string;
  back?: boolean; // when true, show back side
  phone?: string | null;
  email?: string | null;
}

// Realistic product-style front/back membership card with reflective surface
const IdCardMockup = forwardRef<HTMLDivElement, IdCardMockupProps>(function IdCardMockup(
  { name, membershipNo, expiryLabel, tier, role, photoUrl, contactEmail = "lostcard@yourcompany.com", back = false, phone = null, email = null },
  ref
) {
  // Base dark metallic gradient and subtle dot pattern
  const baseCard = cn(
    "relative rounded-xl border-2 overflow-hidden shadow-xl",
    // Matte black: reduced specular highlights, subtle texture
    "bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.05),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.04),transparent_35%),linear-gradient(135deg,#0b0c0f,#0e1115,#12151a)]",
    "border-[#2a2d33]"
  );

  const dottedOverlay = "bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:6px_6px] opacity-30";
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const url = await makeProfileQR({ name, phone, email, ecellId: membershipNo });
      if (mounted) setQrUrl(url);
    })();
    return () => {
      mounted = false;
    };
  }, [name, phone, email, membershipNo]);

  // Determine badge text + color based on role / tier
  const getBadgeInfo = () => {
    const councilRoles = ["COMMITTEE", "DEPT_HEAD", "MENTOR"];
    let badgeLabel = "Member";
    let badgeColorClass = "px-3 py-1 rounded-full bg-gray-200 text-gray-900"; // Silver default

    const userObj: { role: string; tier: string } = { role: role ?? "", tier };
    if (councilRoles.includes(userObj.role) || userObj.tier !== "Silver") {
      badgeLabel = "COUNCIL";
      badgeColorClass = "px-3 py-1 rounded-full bg-yellow-500 text-black"; // Gold badge
    }

    return { badgeLabel, badgeColorClass };
  };

  const { badgeLabel, badgeColorClass } = getBadgeInfo();

  return (
    <div ref={ref} className="relative">
      

      {/* Flip container */}
      <div className="relative mx-auto" style={{ perspective: "1000px" }}>
        <div
          className={cn(baseCard, "h-48 w-[420px] transition-transform duration-500")}
          style={{ transformStyle: "preserve-3d", transformOrigin: "center center", transform: back ? "rotateY(180deg)" : "rotateY(0deg)", willChange: "transform" }}
        >
          <div
            className="absolute inset-0"
            style={{ transform: "rotateY(0deg)", display: back ? "none" : "block" }}
          >
            {/* Accent stripe */}
            <div className="absolute left-0 top-0 h-full w-3 bg-gradient-to-b from-gray-300/70 to-gray-500/70" />
            {/* Shine */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/6 via-transparent to-transparent" />
            {/* Diagonal soft reflection band */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-6 right-10 h-[160%] w-1/2 rotate-[18deg] bg-gradient-to-b from-white/10 via-transparent to-transparent" />
            </div>
            {/* Dots */}
            <div className={cn("absolute inset-0", dottedOverlay.replace("opacity-30", "opacity-15"))} />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-center px-5 pt-4">
              <div className="flex items-center gap-3">
                <img src="/favicon.ico" alt="Logo" className="h-5 w-5 rounded-sm" />
                <span className="text-xs tracking-wider text-gray-300">MEMBERSHIP CARD</span>
              </div>
              <Badge className={badgeColorClass}>{badgeLabel}</Badge>
            </div>

            {/* GLA Logo - Bottom Right */}
            <div className="absolute bottom-4 right-4 z-10">
              <img 
                src="/gla logo.ico" 
                alt="GLA Logo" 
                className="w-20 h-30 object-contain opacity-80"
                style={{ padding: '10px' }}
              />
            </div>

            {/* Main */}
            <div className="relative z-10 mt-4 px-5 flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-gray-300/70 shadow-md rounded-full">
                <AvatarImage src={photoUrl || undefined} />
                <AvatarFallback>
                  <User className="h-7 w-7" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-white font-semibold tracking-tight text-sm md:text-base">{name}</div>
                <div className="text-xs text-gray-300">Membership No: {membershipNo}</div>
                <div className="text-xs text-gray-400">Position: {expiryLabel}</div>
              </div>
              {/* No NFC icon per request */}
            </div>
          </div>

          <div
            className="absolute inset-0"
            style={{ transform: "rotateY(180deg)", display: back ? "block" : "none" }}
          >
            {/* Accent stripe */}
            <div className="absolute left-0 top-0 h-full w-3 bg-gradient-to-b from-gray-300/70 to-gray-500/70" />
            {/* Shine */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            {/* Magnetic strip */}
            <div className="absolute top-4 left-5 right-5 h-8 bg-black/80 rounded-sm" />
            {/* QR placeholder */}
            <div className="absolute bottom-6 left-5 w-28 h-28 bg-white rounded-md border border-black/10 grid place-items-center overflow-hidden">
              {qrUrl ? (
                <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] text-black/80 text-center px-1">QR CODE</span>
              )}
            </div>
            {/* Info */}
            <div className="absolute bottom-6 right-5 text-[10px] text-white text-right">
              <div>{membershipNo}</div>
              <div>Contact: {contactEmail}</div>
            </div>
            {/* Terms */}
            <div className="absolute left-5 right-5 bottom-2 text-[9px] text-gray-200">
              <div>Property of E-Cell GLA • If found, please contact the email above.</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
});

export default IdCardMockup;
