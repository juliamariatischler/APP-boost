import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const variants = [
  { id: 1, title: "Variante 1", description: "10 Liegestütze" },
  { id: 2, title: "Variante 2", description: "20 Kniebeugen" },
  { id: 3, title: "Variante 3", description: "30 Sekunden Plank" },
  { id: 4, title: "Variante 4", description: "15 Hampelmänner" },
];

export const ChallengeVariants = () => {
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  const handleSelect = (id: number) => {
    setSelectedVariant(id);
    const variant = variants.find(v => v.id === id);
    toast.success(`${variant?.title} ausgewählt!`);
  };

  return (
    <div className="mb-20">
      <h3 className="text-lg font-bold mb-4 text-foreground">
        Wähle deine Variante:
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {variants.map((variant) => (
          <Card
            key={variant.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedVariant === variant.id
                ? "bg-primary/10 border-primary shadow-lg"
                : "bg-card hover:shadow-md"
            }`}
            onClick={() => handleSelect(variant.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-foreground">{variant.title}</h4>
              {selectedVariant === variant.id && (
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{variant.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};
