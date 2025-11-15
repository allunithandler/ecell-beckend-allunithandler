import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProfileNameInputProps {
  initialValue?: string;
  onSave: (name: string) => Promise<void>;
  disabled?: boolean;
}

export const ProfileNameInput = ({ initialValue = "", onSave, disabled = false }: ProfileNameInputProps) => {
  const [name, setName] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setName(initialValue);
  }, [initialValue]);

  const validateName = (value: string): string | null => {
    if (value.length < 2) {
      return "Name must be at least 2 characters long";
    }
    if (value.length > 50) {
      return "Name must be at most 50 characters long";
    }
    if (!/^[a-zA-Z\s\-']+$/.test(value)) {
      return "Name can only contain letters, spaces, hyphens, and apostrophes";
    }
    return null;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    
    const validationError = validateName(value);
    setError(validationError || "");
  };

  const handleSave = async () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(name.trim());
      toast.success("Name updated successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update name";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = name.trim() !== initialValue.trim();

  return (
    <div className="space-y-2">
      <Label htmlFor="profile-name">Full Name</Label>
      <div className="flex gap-2">
        <Input
          id="profile-name"
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Enter your full name"
          disabled={disabled || isSaving}
          className={error ? "border-red-500" : ""}
          maxLength={50}
        />
        <Button
          onClick={handleSave}
          disabled={disabled || isSaving || !hasChanges || !!error}
          size="sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <p className="text-xs text-gray-500">
        {name.length}/50 characters
      </p>
    </div>
  );
};