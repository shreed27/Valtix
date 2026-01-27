"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookUser,
  Plus,
  QrCode,
  Copy,
  Check,
  Trash2,
} from "lucide-react";

import { contactsApi, type Contact } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncateAddress, copyToClipboard } from "@/lib/utils";

export default function ContactsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState<Contact | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [chain, setChain] = useState("solana");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: contactsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => contactsApi.create({ name, chain, address, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setShowAdd(false);
      setName("");
      setAddress("");
      setNotes("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const handleCopy = async (address: string) => {
    await copyToClipboard(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShowQR = async (contact: Contact) => {
    setShowQR(contact);
    const qr = await contactsApi.generateQR(contact.chain, contact.address);
    setQrData(qr.qr_data_url);
  };

  return (
    <div className="min-h-screen container max-w-2xl mx-auto py-8">
      <Button
        variant="ghost"
        className="mb-4 -ml-2 hover:bg-transparent hover:text-primary"
        onClick={() => router.push("/")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BookUser className="h-5 w-5" />
              Address Book
            </CardTitle>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add Contact Form */}
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 p-4 rounded-lg bg-secondary/50 space-y-3"
            >
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solana">Solana</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !name || !address}
                >
                  {createMutation.isPending ? "Adding..." : "Add Contact"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Contacts List */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading contacts...
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${contact.chain === "solana"
                        ? "bg-purple-500"
                        : "bg-blue-500"
                        }`}
                    />
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {truncateAddress(contact.address)}
                      </p>
                      {contact.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(contact.address)}
                    >
                      {copied === contact.address ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleShowQR(contact)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(contact.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookUser className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No contacts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add contacts to quickly send to them
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"
          onClick={() => {
            setShowQR(null);
            setQrData(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card p-6 rounded-lg shadow-lg max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">{showQR.name}</h3>
            {qrData ? (
              <img
                src={qrData}
                alt="QR Code"
                className="w-full aspect-square rounded-lg bg-white p-4"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-secondary flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">
                  Loading...
                </div>
              </div>
            )}
            <p className="text-sm text-center text-muted-foreground mt-4 break-all">
              {showQR.address}
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => {
                setShowQR(null);
                setQrData(null);
              }}
            >
              Close
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
