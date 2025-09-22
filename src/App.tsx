import { useState, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import { ContactSidebar } from "./components/ContactSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { LoginScreen } from "./components/LoginScreen";
import type { Message, Contact } from "./types";
import axios from "axios";
import { io } from "socket.io-client";

// Replace localhost with your deployed backend URL
const socket = io("https://your-backend.onrender.com");
axios.get(`https://your-backend.onrender.com/messages/${currentUser}/${contactId}`);


export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | undefined>();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth < 768);
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const activeContact = contacts.find(contact => contact.id === activeContactId);
  const currentMessages = activeContactId ? messages[activeContactId] || [] : [];

  // Handle login
  const handleLogin = useCallback((username: string) => {
    setCurrentUser(username);
    socket.emit("join", username);
  }, []);

  // Select contact
  const handleContactSelect = useCallback((contactId: string) => {
    setActiveContactId(contactId);

    // Fetch chat history from backend
    if (currentUser) {
      axios.get(`http://localhost:5000/messages/${currentUser}/${contactId}`)
        .then(res => {
          setMessages(prev => ({
            ...prev,
            [contactId]: res.data.map((msg: any) => ({
              id: msg._id,
              text: msg.text,
              timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isSent: msg.sender === currentUser,
              isDelivered: msg.sender === currentUser,
              isRead: msg.sender === currentUser,
            }))
          }));
        });
    }

    // Reset unread count
    setContacts(prev => prev.map(contact => 
      contact.id === contactId ? { ...contact, unreadCount: 0 } : contact
    ));

    if (isMobile) setMobileView('chat');
  }, [currentUser, isMobile]);

  // Start new chat
  const handleStartNewChat = useCallback((username: string) => {
    const existingContact = contacts.find(c => c.name.toLowerCase() === username.toLowerCase());
    if (existingContact) {
      handleContactSelect(existingContact.id);
      return;
    }

    const newContact: Contact = {
      id: Date.now().toString(),
      name: username,
      avatar: '',
      lastMessage: 'Started a conversation',
      timestamp: 'now',
      isOnline: true,
    };
    setContacts(prev => [...prev, newContact]);
    setMessages(prev => ({ ...prev, [newContact.id]: [] }));
    handleContactSelect(newContact.id);
  }, [contacts, handleContactSelect]);

  const handleBackToSidebar = useCallback(() => setMobileView('sidebar'), []);

  // Send message
  const handleSendMessage = useCallback((messageText: string) => {
    if (!activeContactId || !currentUser) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSent: true,
      isDelivered: true,
    };

    // Send to backend
    socket.emit("sendMessage", {
      sender: currentUser,
      receiver: activeContactId,
      text: messageText,
    });

    // Update UI immediately
    setMessages(prev => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || []), newMessage],
    }));

    // Update last message in contact
    setContacts(prev => prev.map(contact => 
      contact.id === activeContactId ? { ...contact, lastMessage: messageText, timestamp: 'now' } : contact
    ));
  }, [activeContactId, currentUser]);

  // Receive messages from backend
  useEffect(() => {
    socket.on("receiveMessage", (msg: any) => {
      // Add sender as contact if new
      if (!contacts.find(c => c.id === msg.sender)) {
        const newContact: Contact = {
          id: msg.sender,
          name: msg.sender,
          avatar: '',
          lastMessage: msg.text,
          timestamp: 'now',
          isOnline: true,
        };
        setContacts(prev => [...prev, newContact]);
      }

      // Update messages
      setMessages(prev => ({
        ...prev,
        [msg.sender]: [...(prev[msg.sender] || []), {
          id: Date.now().toString(),
          text: msg.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSent: false,
        }]
      }));
    });

    return () => socket.off("receiveMessage");
  }, [contacts]);

  if (!currentUser) return <LoginScreen onLogin={handleLogin} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen flex flex-col md:flex-row bg-gradient-to-br from-gray-900 via-blue-900 to-blue-950 relative overflow-hidden"
    >
      {/* Background animations omitted for brevity */}

      <div className="md:flex md:h-full w-full h-full relative">
        {/* Mobile Layout */}
        <div className="md:hidden h-full w-full relative overflow-hidden">
          {/* Sidebar View */}
          <motion.div
            initial={false}
            animate={{ x: mobileView === 'sidebar' ? 0 : '-100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.3 }}
            className="absolute inset-0 w-full h-full"
          >
            <ContactSidebar
              contacts={contacts}
              activeContactId={activeContactId}
              onContactSelect={handleContactSelect}
              onStartNewChat={handleStartNewChat}
              currentUser={currentUser}
            />
          </motion.div>

          {/* Chat View */}
          <motion.div
            initial={false}
            animate={{ x: mobileView === 'chat' ? 0 : '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.3 }}
            className="absolute inset-0 w-full h-full"
          >
            <ChatWindow
              contact={activeContact}
              messages={currentMessages}
              onSendMessage={handleSendMessage}
              onBack={handleBackToSidebar}
              isMobile={true}
            />
          </motion.div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex w-full h-full">
          <ContactSidebar
            contacts={contacts}
            activeContactId={activeContactId}
            onContactSelect={handleContactSelect}
            onStartNewChat={handleStartNewChat}
            currentUser={currentUser}
          />
          <ChatWindow
            contact={activeContact}
            messages={currentMessages}
            onSendMessage={handleSendMessage}
            onBack={handleBackToSidebar}
            isMobile={false}
          />
        </div>
      </div>
    </motion.div>
  );
}
