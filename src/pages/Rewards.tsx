import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Zap, Lock, CheckCircle, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BottomNav } from "@/components/BottomNav";
import boostLogo from "@/assets/boost-logo.png";

// Mock: User's current flashes (would come from profile)
const MY_FLASHES = 12;
const CLASS_FLASHES = 248;

// Individual Rewards
const PERSONAL_REWARDS = [
  { 
    id: 1, 
    title: "BIPA Gutschein 5€", 
    partner: "BIPA", 
    threshold: 50, 
    category: "gutscheine",
    icon: "🎀"
  },
  { 
    id: 2, 
    title: "dm Gutschein 5€", 
    partner: "dm", 
    threshold: 75, 
    category: "gutscheine",
    icon: "🧴"
  },
  { 
    id: 3, 
    title: "Sport-Trinkflasche", 
    partner: "Intersport", 
    threshold: 100, 
    category: "sport",
    icon: "🍶"
  },
  { 
    id: 4, 
    title: "Nike Socken", 
    partner: "Nike", 
    threshold: 150, 
    category: "sport",
    icon: "🧦"
  },
  { 
    id: 5, 
    title: "SPAR Gutschein 10€", 
    partner: "SPAR", 
    threshold: 200, 
    category: "gutscheine",
    icon: "🛒"
  },
  { 
    id: 6, 
    title: "Fitness-Armband", 
    partner: "Gigasport", 
    threshold: 300, 
    category: "zubehoer",
    icon: "⌚"
  },
  { 
    id: 7, 
    title: "Sport-Rucksack", 
    partner: "Intersport", 
    threshold: 400, 
    category: "sport",
    icon: "🎒"
  },
  { 
    id: 8, 
    title: "dm Gutschein 20€", 
    partner: "dm", 
    threshold: 500, 
    category: "gutscheine",
    icon: "🧴"
  },
];

// Class Milestones
const CLASS_MILESTONES = [
  { 
    threshold: 200, 
    title: "Extra Bewegungsstunde",
    description: "Eine zusätzliche Sportstunde für eure Klasse",
    icon: "🏃"
  },
  { 
    threshold: 300, 
    title: "Klassen-Equipment",
    description: "Bälle, Seile und mehr für eure Klasse",
    icon: "⚽"
  },
  { 
    threshold: 500, 
    title: "Klassen-Event",
    description: "Ein besonderes Sport-Event für eure Klasse",
    icon: "🎉"
  },
  { 
    threshold: 750, 
    title: "Partner-Paket",
    description: "Großes Überraschungspaket von unseren Partnern",
    icon: "🎁"
  },
];

const CATEGORIES = [
  { id: "alle", label: "Alle" },
  { id: "sport", label: "Sport" },
  { id: "gutscheine", label: "Gutscheine" },
  { id: "zubehoer", label: "Zubehör" },
];

const Rewards = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("alle");

  const filteredRewards = activeCategory === "alle" 
    ? PERSONAL_REWARDS 
    : PERSONAL_REWARDS.filter(r => r.category === activeCategory);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-pink-500 to-purple-600 p-6 pb-8">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Gift className="h-7 w-7" />
              Geschenke
            </h1>
            <img src={boostLogo} alt="BOOST Logo" className="h-10 w-auto brightness-0 invert" />
          </div>
          <p className="text-white/80 text-sm">
            Sammle Blitze und schalte echte Rewards frei
          </p>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 -mt-4">
        {/* Current Status */}
        <Card className="p-4 mb-4 bg-card shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Du:</span>
                <span className="font-bold text-foreground">{MY_FLASHES}</span>
                <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Klasse:</span>
                <span className="font-bold text-foreground">{CLASS_FLASHES}</span>
                <Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Für mich
            </TabsTrigger>
            <TabsTrigger value="class" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Für die Klasse
            </TabsTrigger>
          </TabsList>

          {/* Personal Rewards Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap"
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            {/* Rewards Grid */}
            <div className="grid gap-3">
              {filteredRewards.map((reward) => {
                const isUnlocked = MY_FLASHES >= reward.threshold;
                const flashesNeeded = reward.threshold - MY_FLASHES;
                
                return (
                  <Card 
                    key={reward.id}
                    className={`p-4 ${isUnlocked ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" : "bg-card"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-3xl">{reward.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-foreground">{reward.title}</span>
                          {isUnlocked ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          Partner: {reward.partner}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-muted-foreground">ab</span>
                            <span className="font-bold">{reward.threshold}</span>
                            <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          </div>
                          {!isUnlocked && (
                            <span className="text-xs text-orange-500">
                              (noch {flashesNeeded} ⚡)
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        {isUnlocked ? (
                          <Button size="sm" className="bg-green-500 hover:bg-green-600">
                            Anfordern
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => navigate("/challenge/daily")}
                          >
                            Mehr ⚡
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Transparency Note */}
            <p className="text-xs text-muted-foreground text-center mt-4 px-4">
              Solange der Vorrat reicht. Keine Käufe, keine Werbung – Rewards als Motivation für Bewegung.
            </p>
          </TabsContent>

          {/* Class Rewards Tab */}
          <TabsContent value="class" className="space-y-4">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <p className="text-sm text-center text-foreground">
                <span className="font-bold">Jeder Blitz zählt für eure Klasse.</span><br />
                <span className="text-muted-foreground">Gemeinsam schafft ihr das nächste Ziel!</span>
              </p>
            </Card>

            {/* Milestone Roadmap */}
            <div className="relative">
              {CLASS_MILESTONES.map((milestone, index) => {
                const isUnlocked = CLASS_FLASHES >= milestone.threshold;
                const progress = Math.min((CLASS_FLASHES / milestone.threshold) * 100, 100);
                const flashesNeeded = milestone.threshold - CLASS_FLASHES;
                const isNext = !isUnlocked && (index === 0 || CLASS_FLASHES >= CLASS_MILESTONES[index - 1].threshold);

                return (
                  <div key={milestone.threshold} className="relative">
                    {/* Connector Line */}
                    {index > 0 && (
                      <div className="absolute left-6 -top-4 w-0.5 h-4 bg-border" />
                    )}
                    
                    <Card 
                      className={`p-4 mb-4 ${
                        isUnlocked 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900" 
                          : isNext 
                            ? "bg-primary/5 border-primary/30" 
                            : "bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`text-3xl w-12 h-12 flex items-center justify-center rounded-full ${
                          isUnlocked 
                            ? "bg-green-100 dark:bg-green-900/30" 
                            : "bg-muted"
                        }`}>
                          {isUnlocked ? "✅" : milestone.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-foreground">{milestone.title}</span>
                            <div className="flex items-center gap-1 text-sm">
                              <span className="font-bold">{milestone.threshold}</span>
                              <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {milestone.description}
                          </p>
                          
                          {!isUnlocked && (
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{CLASS_FLASHES} / {milestone.threshold}</span>
                                <span className="text-primary font-medium">
                                  Noch {flashesNeeded} ⚡
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {isUnlocked && (
                            <div className="flex items-center gap-2 text-green-600 text-sm">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-medium">Freigeschaltet!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <Card className="p-4 bg-gradient-to-br from-primary to-accent text-white">
              <div className="text-center">
                <p className="font-bold mb-2">Hilf deiner Klasse!</p>
                <p className="text-sm opacity-90 mb-3">
                  Jeder abgeschlossene Tag bringt euch näher zum nächsten Ziel.
                </p>
                <Button 
                  onClick={() => navigate("/challenge/daily")}
                  className="bg-white text-primary hover:bg-white/90 font-bold"
                >
                  Zur Tageschallenge
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
};

export default Rewards;
