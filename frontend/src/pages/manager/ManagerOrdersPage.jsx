import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { subscriptionsApi } from '../../features/subscriptions/subscriptionsApi';

const formatVND = (amount) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const ManagerOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState(null);

  const fetchOrders = async () => {
    try {
      setError(null);
      const res = await subscriptionsApi.getAllOrders();
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Lỗi khi tải đơn hàng:", error);
      setError('Không thể tải danh sách đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await subscriptionsApi.updateOrderStatus(id, status);
      fetchOrders();
    } catch (error) {
      console.error("Lỗi khi duyệt đơn:", error);
      alert("Cập nhật trạng thái thất bại.");
    }
  };

  const filteredOrders = Array.isArray(orders) 
    ? (filter === 'ALL' ? orders : orders.filter(o => o.status === filter))
    : [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Đơn Hàng</h1>
        <select 
          className="bg-white border text-sm rounded-lg focus:ring-blue-500 py-2 px-3"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt (Pending)</option>
          <option value="ACTIVE">Hoạt động (Active)</option>
          <option value="EXPIRED">Đã hết hạn (Expired)</option>
          <option value="CANCELLED">Đã huỷ (Cancelled)</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-sm font-semibold text-slate-600">ID</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Khách Hàng</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Gói Dịch Vụ</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Số Tiền</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Thanh Toán</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Trạng Thái</th>
                <th className="p-4 text-sm font-semibold text-slate-600">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-6 text-slate-500">
                    Không có đơn hàng nào
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 text-sm text-slate-800 font-medium">#{order.id}</td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-slate-800">{order.userFullName}</div>
                      <div className="text-xs text-slate-500">{order.userEmail}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{order.packageName}</td>
                    <td className="p-4 text-sm font-medium text-slate-800">{formatVND(order.amountPaid)}</td>
                    <td className="p-4 text-sm text-slate-600 capitalize">{order.paymentMethod}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                        ${order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 
                          order.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                          order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 
                          'bg-slate-100 text-slate-700'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 flex gap-2">
                      {order.status === 'PENDING' && (
                        <>
                          <button 
                            title="Duyệt đơn"
                            className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition"
                            onClick={() => handleUpdateStatus(order.id, 'ACTIVE')}
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button 
                            title="Huỷ đơn"
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                            onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManagerOrdersPage;
