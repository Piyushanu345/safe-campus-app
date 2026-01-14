"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useMemo, useState } from "react";
import {
  ShieldAlert,
  Map as MapIcon,
  LogOut,
  MapPin,
  Users,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/database.types";

/* ---------- MAP (NO SSR) ---------- */
const LeafMap = dynamic(() => import("./components/LeafMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <MapIcon className="text-slate-400 animate-bounce" size={40} />
    </div>
  ),
});

/* ---------- TYPES ---------- */
type Incident = Tables<"incidents">;

type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  user_id: string | null;
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);

  /* ---------- STATE ---------- */
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] =
    useState<"map" | "contacts" | "alerts">("map");

  const [location, setLocation] =
    useState<{ lat: number; lng: number } | null>(null);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<Incident[]>([]);
  const [isSOSActive, setIsSOSActive] = useState(false);

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  /* ---------- GEOLOCATION ---------- */
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setLocation({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        }),
      () => setLocation({ lat: 27.4924, lng: 77.6737 })
    );
  }, []);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  /* ---------- INCIDENTS (MAP) ---------- */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .eq("status", "active");

      if (data) setIncidents(data);
    };

    load();

    const channel = supabase
      .channel("incidents-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidents" },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  /* ---------- ALERTS ---------- */
  const loadAlerts = async () => {
    const { data } = await supabase
      .from("incidents")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) setAlerts(data);
  };

  useEffect(() => {
    if (activeTab === "alerts") loadAlerts();
  }, [activeTab]);

  /* ---------- CONTACTS (PUBLIC + PRIVATE) ---------- */
  const loadContacts = async () => {
    const { data } = await supabase
      .from("emergency_contacts")
      .select("id, name, phone, user_id")
      .or(`user_id.is.null${user ? `,user_id.eq.${user.id}` : ""}`)
      .order("created_at", { ascending: false });

    if (data) setContacts(data);
  };

  useEffect(() => {
    if (activeTab === "contacts") loadContacts();
  }, [activeTab, user]);

  const addContact = async () => {
    if (!user || !contactName || !contactPhone) {
      alert("Login and fill all fields");
      return;
    }

    const { error } = await supabase.from("emergency_contacts").insert({
      user_id: user.id,
      name: contactName,
      phone: contactPhone,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setContactName("");
    setContactPhone("");
    loadContacts();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("emergency_contacts").delete().eq("id", id);
    loadContacts();
  };

  /* ---------- AUTH ACTIONS ---------- */
  const handleLogin = async () => {
    const email = prompt("Email:");
    const password = prompt("Password:");
    if (!email || !password) return;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) alert(error.message);
  };

  const handleSignup = async () => {
    const email = prompt("Email:");
    const password = prompt("Password (min 6 chars):");
    if (!email || !password) return;

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) alert(error.message);
    else alert("Signup successful. Check email.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  /* ---------- SOS ---------- */
  const triggerSOS = async () => {
    if (!user || !location) {
      alert("Login and location required");
      return;
    }

    setIsSOSActive(true);

    await supabase.from("incidents").insert({
      user_id: user.id,
      type: "SOS",
      latitude: location.lat,
      longitude: location.lng,
      description: "Emergency SOS triggered",
      status: "active",
    });

    setTimeout(() => setIsSOSActive(false), 4000);
  };

  if (loading) {
    return <div className="h-screen grid place-items-center">Loading…</div>;
  }

  /* ---------- UI ---------- */
  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b px-6 py-4 flex justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-red-600" />
          <h1 className="font-bold">SafeCampus</h1>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user.email}</span>
            <button onClick={handleLogout}>
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={handleLogin} className="text-blue-600">
              Login
            </button>
            <button
              onClick={handleSignup}
              className="bg-blue-600 text-white px-4 py-1.5 rounded"
            >
              Sign up
            </button>
          </div>
        )}
      </header>

      {/* CONTENT */}
      <main className="flex-1 relative">
        {/* MAP */}
        {activeTab === "map" && location && (
          <>
            <LeafMap center={location} incidents={incidents} />
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
              <button
                onClick={triggerSOS}
                className={cn(
                  "w-28 h-28 rounded-full bg-red-600 text-white font-bold shadow-lg",
                  isSOSActive && "animate-pulse"
                )}
              >
                SOS
              </button>
            </div>
          </>
        )}

        {/* CONTACTS */}
        {activeTab === "contacts" && (
          <div className="p-6 max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              Emergency Contacts
            </h2>

            {user && (
              <div className="space-y-2 mb-4">
                <input
                  className="border p-2 w-full rounded"
                  placeholder="Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
                <input
                  className="border p-2 w-full rounded"
                  placeholder="Phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
                <button
                  onClick={addContact}
                  className="bg-blue-600 text-white px-4 py-2 rounded w-full"
                >
                  Add Contact
                </button>
              </div>
            )}

            {contacts.length === 0 ? (
              <p className="text-slate-600">No contacts found.</p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center border p-2 rounded"
                  >
                    <div>
                      <p className="font-medium">
                        {c.name}
                        {!c.user_id && (
                          <span className="ml-2 text-xs text-green-600">
                            (Public)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-600">{c.phone}</p>
                    </div>

                    {c.user_id && (
                      <button
                        onClick={() => deleteContact(c.id)}
                        className="text-red-600 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ALERTS */}
        {activeTab === "alerts" && (
          <div className="p-6 max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Alerts</h2>

            {alerts.length === 0 ? (
              <p className="text-slate-600">No active alerts.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a) => (
                  <li
                    key={a.id}
                    className="border rounded p-3 bg-white shadow-sm"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-red-600">{a.type}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(a.created_at!).toLocaleString()}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-slate-700 mt-1">{a.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <footer className="flex justify-around items-center py-3 border-t bg-white">
        <button
          onClick={() => setActiveTab("map")}
          className={cn(
            "flex flex-col items-center text-sm",
            activeTab === "map" && "text-blue-600"
          )}
        >
          <MapPin size={18} />
          Map
        </button>

        <button
          onClick={() => setActiveTab("contacts")}
          className={cn(
            "flex flex-col items-center text-sm",
            activeTab === "contacts" && "text-blue-600"
          )}
        >
          <Users size={18} />
          Contacts
        </button>

        <button
          onClick={() => setActiveTab("alerts")}
          className={cn(
            "flex flex-col items-center text-sm",
            activeTab === "alerts" && "text-blue-600"
          )}
        >
          <AlertTriangle size={18} />
          Alerts
        </button>
      </footer>
    </div>
  );
}
