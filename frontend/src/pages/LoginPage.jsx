import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { loginSuccess } from '../features/auth/authSlice';
import * as yup from 'yup';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const schema = yup.object().shape({
    email: yup.string().email('Email không hợp lệ').required('Vui lòng nhập email'),
    password: yup.string().required('Vui lòng nhập mật khẩu')
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    mode: 'onBlur'
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      // Backend returns AuthResponse { accessToken, refreshToken, user: { id, fullName, email, role, isActive } }
      dispatch(loginSuccess(response.data));
      navigate('/dashboard');
    } catch (error) {
      console.error("Đăng nhập thất bại:", error);
      alert(error.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 border border-slate-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-display text-blue-600 mb-2">PlanbookAI</h1>
          <h2 className="text-2xl font-bold text-slate-800">Chào mừng trở lại</h2>
          <p className="text-slate-500 mt-2">Vui lòng đăng nhập để tiếp tục</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
               {...register('email')}
                type="email"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg  focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="name@example.com"
                required
              />
               {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}

            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Mật khẩu</label>
              <Link to="/forgot-password" disabled className="text-sm font-medium text-blue-600 hover:text-blue-700">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
               {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
               {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-slate-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">
              Ghi nhớ đăng nhập
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus focus:ring-blue-500 transition-colors disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>Đăng nhập <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-slate-500">Chưa có tài khoản? </span>
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">Đăng ký ngay</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;