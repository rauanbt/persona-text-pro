import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette } from "lucide-react";

interface ToneSelectorProps {
  selectedTone: string;
  onToneChange: (tone: string) => void;
}

export const ToneSelector = ({ selectedTone, onToneChange }: ToneSelectorProps) => {
  const tones = [
    { value: "regular", label: "Regular", description: "Natural, balanced tone" },
    { value: "formal", label: "Formal/Academic", description: "Professional, scholarly tone" },
    { value: "persuasive", label: "Persuasive/Sales", description: "Compelling, convincing tone" },
    { value: "empathetic", label: "Empathetic/Warm", description: "Understanding, caring tone" },
    { value: "sarcastic", label: "Sarcastic", description: "Witty, ironic tone" },
    { value: "funny", label: "Funny", description: "Humorous, entertaining tone" }
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-2 mb-3">
        <Palette className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">Choose Your Tone</span>
      </div>
      <Select value={selectedTone} onValueChange={onToneChange}>
        <SelectTrigger className="w-full max-w-sm bg-background border-2 hover:border-primary/50 transition-colors">
          <SelectValue placeholder="Select tone style" />
        </SelectTrigger>
        <SelectContent className="bg-background border border-border shadow-lg">
          {tones.map((tone) => (
            <SelectItem 
              key={tone.value} 
              value={tone.value}
              className="cursor-pointer hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground"
            >
              <div className="flex flex-col">
                <span className="font-medium">{tone.label}</span>
                <span className="text-sm text-muted-foreground">{tone.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};