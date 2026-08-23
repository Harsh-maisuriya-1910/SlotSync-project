import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";
import { UserPlus, List, Shield } from "lucide-react";
import { useCreateCounsellorMutation } from "../../api/adminApi.js";

const counsellorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminCounsellors() {
  const [createCounsellor, { isLoading }] = useCreateCounsellorMutation();
  const [counsellorsList, setCounsellorsList] = useState([]);

  // Load created counsellors from localStorage for visualization
  useEffect(() => {
    try {
      const stored = localStorage.getItem("slotsync_counsellors");
      if (stored) {
        setCounsellorsList(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(counsellorSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data) => {
    try {
      const response = await createCounsellor(data).unwrap();
      if (response.success && response.data) {
        toast.success("Counsellor account created successfully!");
        
        // Add to local list tracking for view
        const newCounsellor = {
          id: response.data.id || response.data._id,
          name: response.data.name,
          email: response.data.email,
          createdAt: response.data.createdAt || new Date().toISOString(),
        };

        const updatedList = [newCounsellor, ...counsellorsList];
        setCounsellorsList(updatedList);
        localStorage.setItem("slotsync_counsellors", JSON.stringify(updatedList));
        reset();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err?.data?.message || "Failed to create counsellor user.";
      toast.error(errMsg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">Manage Counsellors</h1>
        <p className="text-slate-500 text-sm">Create new counsellor staff credentials and view existing registrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Form Column */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-lg p-6 shadow-sm h-fit">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <UserPlus className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900">Add Counsellor</h2>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                disabled={isLoading}
                placeholder="Dr. Sarah Connor"
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.name
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("name")}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                disabled={isLoading}
                placeholder="sarah.c@slotsync.com"
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.email
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Temporary Password
              </label>
              <input
                id="password"
                type="password"
                disabled={isLoading}
                placeholder="••••••••"
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none ${
                  errors.password
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500"
                    : "border-slate-200 focus:ring-primary-500 focus:border-primary-500"
                } disabled:bg-slate-50`}
                {...register("password")}
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>

        {/* View Counsellors Column */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
            <List className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Added Counsellors</h2>
          </div>

          {counsellorsList.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-md">
              <Shield className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-900">No counsellors created yet</p>
              <p className="text-xs text-slate-500 mt-1">Use the form on the left to add a new counsellor staff member.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Date Added
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {counsellorsList.map((counsellor) => (
                    <tr key={counsellor.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-950">
                        {counsellor.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {counsellor.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(counsellor.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
