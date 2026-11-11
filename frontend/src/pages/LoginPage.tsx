import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { API_BASE, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { errorMessage } from '@/components/ui/Toast';
import { fetchMe, firstRoute, ME_KEY } from '@/routes/authGuards';
import { useSessionStore } from '@/stores/sessionStore';

const schema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
type FormValues = z.infer<typeof schema>;

/** 1.1 Đăng nhập hệ thống / 1.2 Thông tin không hợp lệ */
export function LoginPage() {
  const search = useSearch({ strict: false }) as { redirect?: string; error?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setMe = useSessionStore((s) => s.setMe);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(search.error ?? null);
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  const onSubmit = async (v: FormValues) => {
    setError(null);
    try {
      await post(EP.auth.login, v);
      qc.clear();
      const me = await qc.fetchQuery({ queryKey: ME_KEY, queryFn: fetchMe });
      setMe(me);
      const target = search.redirect && search.redirect.startsWith('/') && !search.redirect.startsWith('/login') ? search.redirect : firstRoute(me);
      navigate({ to: target });
    } catch (e) {
      setError(errorMessage(e, 'Tên đăng nhập hoặc mật khẩu không đúng'));
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-[#0b5cab] to-[#063a6e] p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="VNPT" className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-xl font-bold text-primary">Hệ thống quản trị KPI theo BSC</h1>
          <p className="mt-1 text-sm text-muted">Tập đoàn Bưu chính Viễn thông Việt Nam</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field label="Tên đăng nhập" htmlFor="username" error={formState.errors.username?.message}>
            <Input id="username" autoComplete="username" autoFocus {...register('username')} aria-invalid={!!formState.errors.username} />
          </Field>
          <Field label="Mật khẩu" htmlFor="password" error={formState.errors.password?.message}>
            <div className="relative">
              <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('password')} aria-invalid={!!formState.errors.password} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-2 text-slate-500" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          {error && (
            <div role="alert" data-testid="login-error" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            <LogIn className="h-4 w-4" />
            Đăng nhập
          </Button>
          <div className="relative py-1 text-center text-xs text-muted">
            <span className="bg-white px-2">hoặc</span>
          </div>
          <Button variant="outline" className="w-full" onClick={() => window.location.assign(API_BASE + EP.auth.ssoLogin)}>
            <ShieldCheck className="h-4 w-4" />
            Đăng nhập bằng VNPT SSO
          </Button>
        </form>
      </div>
    </div>
  );
}
