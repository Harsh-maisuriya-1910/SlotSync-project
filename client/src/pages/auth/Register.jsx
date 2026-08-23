import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { UserPlus } from "lucide-react";
import { useRegisterMutation } from "../../api/authApi.js";

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function Register() {
  const navigate = useNavigate();
  const [signUp, { isLoading }] = useRegisterMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (data) => {
    try {
      const response = await signUp({
        name: data.name,
        email: data.email,
        password: data.password,
      }).unwrap();

      if (response.success) {
        toast.success("Account created successfully! Please sign in.");
        navigate("/login");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Registration failed. Please try again.";
      toast.error(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary-600 text-white">
            <UserPlus className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Create Student Account
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-slate-200 sm:rounded-lg sm:px-10 shadow-sm">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  disabled={isLoading}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    errors.name ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300 focus:ring-primary-500 focus:border-primary-500"
                  } rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm disabled:bg-slate-100 disabled:text-slate-500`}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="mt-2 text-xs text-red-600" id="name-error">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  disabled={isLoading}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    errors.email ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300 focus:ring-primary-500 focus:border-primary-500"
                  } rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm disabled:bg-slate-100 disabled:text-slate-500`}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-xs text-red-600" id="email-error">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  disabled={isLoading}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    errors.password ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300 focus:ring-primary-500 focus:border-primary-500"
                  } rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm disabled:bg-slate-100 disabled:text-slate-500`}
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-xs text-red-600" id="password-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  type="password"
                  disabled={isLoading}
                  className={`appearance-none block w-full px-3 py-2 border ${
                    errors.confirmPassword ? "border-red-300 focus:ring-red-500 focus:border-red-500" : "border-slate-300 focus:ring-primary-500 focus:border-primary-500"
                  } rounded-md shadow-sm placeholder-slate-400 focus:outline-none sm:text-sm disabled:bg-slate-100 disabled:text-slate-500`}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-2 text-xs text-red-600" id="confirm-password-error">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
