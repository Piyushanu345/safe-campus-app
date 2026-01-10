"use client";

import dynamic from "next/dynamic";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  Map as MapIcon,
  Users,
  AlertTriangle,
  Phone,
  Navigation,
  LogIn,
  LogOut,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Activity,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Tables } from "@/database.types";

/* Leaflet map (NO SSR) */
const LeafMap = dynamic(() => import("./components/LeafMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center">
      <MapIcon className="text-slate-300 animate-bounce" size={48} />
    </div>
  ),
});

/* ---------- TYPES ---------- */

type IncidentMarker = Tables<"incidents">;

interface AIUnsafeZone {
  id: string;
  area: string;
  risk: "High" | "Medium" | "Low";
  reason: string;
  lat: number;
  lng: number;
  incidentCount: number;
}

type UserProfile = Tables<"profiles">;

/* ---------- MAIN COMPONENT ---------- */

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState<"map" | "contacts" | "alerts">("map");

  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [incidents, setIncidents] = useState<IncidentMarker[]>([]);
  const [aiZones, setAiZones] = useState<AIUnsafeZone[]>([]);
  const [notifications, setNotifications] = useState<
    { id: string; msg: string }[]
  >([]);

  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  /* ---------- GEOLOCATION ---------- */
  useEffect(() => {
    const fallback = { lat: 27.4924, lng: 77.6737 };

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setUserLocation(fallback),
      { enableHighAccuracy: true }
    );
  }, []);

  /* ---------- AUTH & PROFILE ---------- */
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      
      if (error) throw error;
      setProfile(profileData);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Get initial session once
      const { data: { user: initialUser } } = await supabase.auth.getUser();
      
      if (mounted) {
        setUser(initialUser);
        if (initialUser) await fetchProfile(initialUser.id);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        
        if (mounted) {
          setUser(currentUser);
          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  /* ---------- INCIDENTS & REALTIME ---------- */
  useEffect(() => {
    const fetchIncidents = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("status", "active");
      if (data) setIncidents(data as IncidentMarker[]);
    };

    fetchIncidents();

    // Realtime subscription
    const channel = supabase
      .channel("incidents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        () => fetchIncidents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  /* ---------- AI ANALYSIS ---------- */
  const runAIAnalysis = useCallback((items: IncidentMarker[]) => {
    setIsAnalyzing(true);

    setTimeout(() => {
      if (items.length === 0) {
        setAiZones([]);
        setIsAnalyzing(false);
        return;
      }

      setAiZones([
        {
          id: "zone-1",
          area: "North Campus",
          risk: "Medium",
          reason: "Repeated incidents detected by AI",
          lat: items[0].latitude,
          lng: items[0].longitude,
          incidentCount: items.length,
        },
      ]);

      setIsAnalyzing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    runAIAnalysis(incidents);
  }, [incidents, runAIAnalysis]);

  /* ---------- ACTIONS ---------- */

  const handleLogin = async () => {
    const email = prompt("Enter your email:");
    if (!email) return;
    const password = prompt("Enter your password:");
    if (!password) return;

    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(`Login failed: ${error.message}`);
      } else {
        setNotifications(n => [...n, { id: Date.now().toString(), msg: "Logged in successfully!" }]);
        setTimeout(() => setNotifications(n => n.slice(1)), 3000);
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred during login.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    if (isAuthLoading) return;

    const email = prompt("Enter email for signup:");
    if (!email) return;
    const password = prompt("Enter password (min 6 chars):");
    if (!password) return;
    const fullName = prompt("Enter your full name:");

    setIsAuthLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) {
        if (error.status === 429) {
          setNotifications(n => [...n, { id: Date.now().toString(), msg: "🚫 Rate limit reached. Please wait a few minutes." }]);
        } else {
          alert(`Signup failed: ${error.message}`);
        }
      } else if (data.user) {
        setNotifications(n => [...n, { id: Date.now().toString(), msg: "📧 Success! Check your email for a link." }]);
      }
    } catch (err) {
      console.error("[Auth] Unexpected Error:", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
  };

  const triggerSOS = async () => {
    if (!user) {
      const proceed = confirm("You must be logged in to trigger an SOS. Would you like to log in now?");
      if (proceed) handleLogin();
      return;
    }

    if (!userLocation) {
      alert("Location access is required to send an SOS. Please enable location services.");
      return;
    }

    setIsSOSActive(true);

    try {
      // 1. Insert the SOS incident into Supabase
      const { error } = await supabase.from("incidents").insert({
        user_id: user.id,
        type: "SOS",
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        status: "active",
        description: "Emergency SOS triggered",
      });

      if (error) throw error;

      // 2. Show immediate visual feedback via notification
      setNotifications((n) => [
        ...n,
        { id: Date.now().toString(), msg: "🚨 SOS sent to campus security" },
      ]);

      // 3. Reset the button state after a delay
      setTimeout(() => {
        setIsSOSActive(false);
        setNotifications((n) => n.slice(1));
      }, 6000);

    } catch (err: any) {
      console.error("SOS Error:", err);
      alert(`Failed to send SOS: ${err.message || "Unknown error"}`);
      setIsSOSActive(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  /* ---------- RENDER ---------- */

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* NOTIFICATIONS OVERLAY */}
      <div className="fixed top-20 right-4 z-[1000] flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2"
            >
              <ShieldAlert size={18} />
              <span className="font-medium">{n.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-red-600" />
          <h1 className="font-bold text-lg">SafeCampus</h1>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500 hidden sm:block">
                {profile?.full_name || user.email}
              </span>
              <button 
                onClick={handleLogout}
                disabled={isAuthLoading}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 disabled:opacity-50"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleLogin}
                disabled={isAuthLoading}
                className="text-sm font-semibold text-blue-600 px-3 py-1 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
              >
                {isAuthLoading ? "..." : "Login"}
              </button>
              <button 
                onClick={handleSignup}
                disabled={isAuthLoading}
                className="text-sm font-semibold bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isAuthLoading ? "Processing..." : "Sign Up"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {/* MAP TAB */}
        {activeTab === "map" && (
          <>
            {userLocation ? (
              <LeafMap key="main-campus-map" center={userLocation} incidents={incidents} />
            ) : (
              <div className="h-full flex items-center justify-center">
                Locating you...
              </div>
            )}

            {/* SOS BUTTON */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
              <button
                onClick={triggerSOS}
                disabled={isSOSActive}
                className={cn(
                  "w-24 h-24 rounded-full bg-red-600 text-white font-bold shadow-2xl border-4 border-white flex flex-col items-center justify-center transition-transform active:scale-95",
                  isSOSActive && "animate-pulse opacity-70"
                )}
              >
                <Phone size={24} className="mb-1" />
                SOS
              </button>
            </div>

            {/* AI INSIGHT OVERLAY */}
            {aiZones.length > 0 && (
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur p-3 rounded-lg shadow-md border border-orange-200 max-w-xs">
                <div className="flex items-center gap-2 text-orange-700 font-bold mb-1">
                  <Sparkles size={16} />
                  <span>AI Safety Alert</span>
                </div>
                <p className="text-xs text-slate-600">
                  {aiZones[0].reason} in {aiZones[0].area}.
                </p>
              </div>
            )}
          </>
        )}

        {/* CONTACTS TAB */}
        {activeTab === "contacts" && (
          <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h2 className="text-2xl font-bold">Emergency Contacts</h2>
            <div className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-500">Campus Security</p>
                <p className="font-bold text-lg">911-CAMPUS</p>
              </div>
              <button className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <Phone />
              </button>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <h3 className="font-semibold mb-3">Personal Contact</h3>
              {profile?.emergency_contact_name ? (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{profile.emergency_contact_name}</p>
                    <p className="text-sm text-slate-500">{profile.emergency_contact_phone}</p>
                  </div>
                  <button className="p-3 bg-green-50 text-green-600 rounded-full">
                    <Phone />
                  </button>
                </div>
              ) : (
                <button className="text-blue-600 text-sm flex items-center gap-1">
                  <Settings size={14} /> Set emergency contact
                </button>
              )}
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === "alerts" && (
          <div className="p-6 space-y-4 overflow-y-auto h-full">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Recent Alerts</h2>
              {isAnalyzing && <Activity className="animate-spin text-blue-500" />}
            </div>
            {incidents.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CheckCircle2 className="mx-auto mb-2 opacity-20" size={48} />
                <p>No active incidents reported</p>
              </div>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className="bg-white p-4 rounded-xl shadow-sm border flex gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center shrink-0",
                    incident.type === 'SOS' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  )}>
                    <AlertTriangle size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-bold">{incident.type}</span>
                      <span className="text-xs text-slate-400">
                        {incident.created_at ? new Date(incident.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{incident.description}</p>
                  </div>
                  <ChevronRight className="text-slate-300 self-center" />
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* NAV */}
      <nav className="bg-white border-t flex justify-around py-3 pb-8">
        <button 
          onClick={() => setActiveTab("map")}
          className={cn("flex flex-col items-center gap-1", activeTab === 'map' ? "text-blue-600" : "text-slate-400")}
        >
          <MapIcon size={24} />
          <span className="text-[10px] font-medium">Map</span>
        </button>
        <button 
          onClick={() => setActiveTab("contacts")}
          className={cn("flex flex-col items-center gap-1", activeTab === 'contacts' ? "text-blue-600" : "text-slate-400")}
        >
          <Users size={24} />
          <span className="text-[10px] font-medium">Contacts</span>
        </button>
        <button 
          onClick={() => setActiveTab("alerts")}
          className={cn("flex flex-col items-center gap-1 relative", activeTab === 'alerts' ? "text-blue-600" : "text-slate-400")}
        >
          <AlertTriangle size={24} />
          {incidents.length > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          )}
          <span className="text-[10px] font-medium">Alerts</span>
        </button>
      </nav>
    </div>
  );
}
