import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { submitContactForm } from '../../lib/contactService';
import { adminLogin } from '../../lib/authService';
import { isConfigured } from '../../lib/firebase';

interface ContactDialogProps {
    open: boolean;
    onClose: () => void;
    dark?: boolean;
}

export default function ContactDialog({ open, onClose, dark = false }: ContactDialogProps) {
    const navigate = useNavigate();
    const [mode, setMode] = useState<'contact' | 'admin'>('contact');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !message.trim()) {
            setErrorMsg('모든 필드를 입력해주세요.');
            setStatus('error');
            return;
        }

        setStatus('sending');

        if (!isConfigured) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatus('success');
            setTimeout(() => handleClose(), 2000);
            return;
        }

        const result = await submitContactForm({ name, email, message });

        if (result.success) {
            setStatus('success');
            setTimeout(() => handleClose(), 2000);
        } else {
            setErrorMsg(result.error || '전송 실패');
            setStatus('error');
        }
    };

    const handleAdminLogin = async () => {
        setAdminLoading(true);
        setErrorMsg('');
        const result = await adminLogin();
        if (result.success) {
            handleClose();
            navigate('/admin');
        } else {
            setErrorMsg(result.error || '로그인 실패');
        }
        setAdminLoading(false);
    };

    const handleClose = () => {
        setName('');
        setEmail('');
        setMessage('');
        setStatus('idle');
        setErrorMsg('');
        setMode('contact');
        setAdminLoading(false);
        onClose();
    };

    const bg = dark ? '#111' : '#f7f6f0';
    const fg = dark ? '#f7f6f0' : '#111';
    const borderCol = dark ? 'rgba(247,246,240,0.15)' : 'rgba(17,17,17,0.15)';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-6"
                    onClick={handleClose}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
                        className="relative w-full max-w-md"
                        style={{ backgroundColor: bg, color: fg }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={handleClose}
                            className="absolute top-5 right-5 text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                        >
                            Close
                        </button>

                        <div className="p-8 md:p-10">
                            {mode === 'contact' ? (
                                <>
                                    <h2 className="text-[9px] uppercase tracking-[0.3em] mb-8" style={{ opacity: 0.4 }}>
                                        Get in Touch
                                    </h2>

                                    {status === 'success' ? (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="py-12 text-center"
                                        >
                                            <p className="text-[11px] uppercase tracking-widest">메시지가 전송되었습니다</p>
                                            <p className="text-[10px] mt-2 opacity-40">Thank you for reaching out</p>
                                        </motion.div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-5">
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Name</label>
                                                <input
                                                    type="text"
                                                    value={name}
                                                    onChange={e => setName(e.target.value)}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="Your name"
                                                    disabled={status === 'sending'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Email</label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="your@email.com"
                                                    disabled={status === 'sending'}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] uppercase tracking-widest mb-2 opacity-40">Message</label>
                                                <textarea
                                                    value={message}
                                                    onChange={e => setMessage(e.target.value)}
                                                    rows={4}
                                                    className="w-full px-0 py-2 text-[13px] border-b outline-none transition-colors resize-none"
                                                    style={{ backgroundColor: 'transparent', borderColor: borderCol, color: fg }}
                                                    placeholder="Tell me about your project..."
                                                    disabled={status === 'sending'}
                                                />
                                            </div>

                                            {status === 'error' && (
                                                <p className="text-[10px] text-red-500">{errorMsg}</p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={status === 'sending'}
                                                className="w-full py-3 text-[10px] uppercase tracking-[0.3em] transition-all duration-300"
                                                style={{
                                                    backgroundColor: fg,
                                                    color: bg,
                                                    opacity: status === 'sending' ? 0.5 : 1,
                                                }}
                                            >
                                                {status === 'sending' ? 'Sending...' : 'Send Message'}
                                            </button>

                                            {!isConfigured && (
                                                <p className="text-[9px] text-center opacity-30 mt-2">
                                                    Demo mode — Firebase 설정 후 실제 전송됩니다
                                                </p>
                                            )}
                                        </form>
                                    )}

                                    {/* Hidden Admin access */}
                                    <div className="mt-8 text-center">
                                        <button
                                            onClick={() => { setMode('admin'); setErrorMsg(''); }}
                                            className="text-[8px] uppercase tracking-widest opacity-15 hover:opacity-40 transition-opacity"
                                        >
                                            Admin
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2 className="text-[9px] uppercase tracking-[0.3em] mb-8" style={{ opacity: 0.4 }}>
                                        Admin Login
                                    </h2>

                                    <div className="py-8 text-center space-y-6">
                                        <p className="text-[10px] opacity-40">Google 계정으로 로그인하세요</p>

                                        {errorMsg && (
                                            <p className="text-[10px] text-red-500">{errorMsg}</p>
                                        )}

                                        <button
                                            onClick={handleAdminLogin}
                                            disabled={adminLoading}
                                            className="w-full py-3 text-[10px] uppercase tracking-[0.3em] transition-all duration-300 flex items-center justify-center gap-3"
                                            style={{
                                                backgroundColor: fg,
                                                color: bg,
                                                opacity: adminLoading ? 0.5 : 1,
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24">
                                                <path fill={bg} d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                                <path fill={bg} d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill={bg} d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill={bg} d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            {adminLoading ? 'Logging in...' : 'Sign in with Google'}
                                        </button>

                                        <button
                                            onClick={() => { setMode('contact'); setErrorMsg(''); }}
                                            className="text-[9px] uppercase tracking-widest opacity-30 hover:opacity-60 transition-opacity"
                                        >
                                            ← Back to Contact
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
