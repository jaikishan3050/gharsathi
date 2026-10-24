import React, { useState } from 'react';
import { useAppData } from '../context/AppDataContext';

/**
 * ManageServices Component
 * Allows administrators to view, edit, add, and delete services and sub-services
 * with side-by-side customization of Sub-Service Price (₹) and Platform Commission Fee (₹).
 */
export default function ManageServices({ onAddServiceClick }) {
  const { services, updateServicePrice, updateSubservicePrice, addSubservice, deleteSubservice } = useAppData();
  const [subPriceDrafts, setSubPriceDrafts] = useState({});
  const [subCommDrafts, setSubCommDrafts] = useState({});
  const [addingSubserviceFor, setAddingSubserviceFor] = useState(null);
  const [notice, setNotice] = useState('');
  const [newSubForm, setNewSubForm] = useState({
    name: '',
    price: '',
    commission_fee: '149',
    time: '45 mins',
    description: '',
  });

  const saveSubPrice = (serviceId, sub) => {
    const rawPrice = subPriceDrafts[sub.id] ?? sub.price;
    const rawComm = subCommDrafts[sub.id] ?? sub.commission_fee ?? sub.commissionFee ?? sub.commission ?? 149;
    const amount = Number(rawPrice);
    const commAmount = Number(rawComm);
    if (!Number.isFinite(amount) || amount < 0) {
      setNotice('Price zero ya positive number hona chahiye.');
      return;
    }
    if (!Number.isFinite(commAmount) || commAmount < 0) {
      setNotice('Commission fee zero ya positive number hona chahiye.');
      return;
    }
    updateSubservicePrice(serviceId, sub.id, amount, commAmount);
    setNotice(`${sub.name} ka rate ₹${amount} aur commission ₹${commAmount} update ho gaya.`);
    setTimeout(() => setNotice(''), 4000);
  };

  const handleCreateSubservice = async (serviceId, service) => {
    const subName = newSubForm.name.trim();
    if (!subName) {
      setNotice('Subservice name required hai.');
      return;
    }
    const price = Number(newSubForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setNotice('Valid price enter karein.');
      return;
    }
    const comm = Number(newSubForm.commission_fee || 149);
    if (!Number.isFinite(comm) || comm < 0) {
      setNotice('Valid commission fee enter karein.');
      return;
    }

    await addSubservice(serviceId, {
      name: subName,
      price,
      commission_fee: comm,
      time: newSubForm.time || '45 mins',
      description: newSubForm.description || '',
    });

    setAddingSubserviceFor(null);
    setNewSubForm({ name: '', price: '', commission_fee: '149', time: '45 mins', description: '' });
    setNotice(`Naya subservice "${subName}" (Rate: ₹${price}, Comm: ₹${comm}) add ho gaya.`);
    setTimeout(() => setNotice(''), 4000);
  };

  return (
    <div className="manage-services-container">
      <div className="manage-services-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Service & Sub-Service Catalogue</h3>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
            Set custom ticket prices and admin platform commission fees independently for each sub-service package.
          </p>
        </div>
        {onAddServiceClick && (
          <button type="button" className="button button-gold" onClick={onAddServiceClick}>
            + Add New Service
          </button>
        )}
      </div>

      {notice && (
        <div className="admin-notice-banner" style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', borderRadius: '6px', marginBottom: '16px' }}>
          ✓ {notice}
        </div>
      )}

      <div className="services-catalogue-grid">
        {(services || []).map((service) => (
          <div key={service.id || service.pk} className="service-catalogue-card" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', background: '#fff' }}>
            <div className="service-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{service.icon || '🧰'}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>{service.name}</h4>
                  <small style={{ color: '#64748b' }}>Category: {service.category} | Base Price: ₹{service.price} | Base Comm: ₹{service.commission_fee || 149}</small>
                </div>
              </div>
              <button
                type="button"
                className="button button-small button-outline"
                onClick={() => {
                  setAddingSubserviceFor(addingSubserviceFor === service.id ? null : service.id);
                  setNewSubForm({ name: '', price: '', commission_fee: String(service.commission_fee || 149), time: '45 mins', description: '' });
                }}
              >
                {addingSubserviceFor === service.id ? '✕ Close' : '+ Add Sub-Service'}
              </button>
            </div>

            {/* Inline Add Subservice Form */}
            {addingSubserviceFor === service.id && (
              <div className="inline-add-sub-box" style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', margin: '14px 0', border: '1px solid #e2e8f0' }}>
                <h5 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Add Package to {service.name}</h5>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Sub-Service Name"
                    value={newSubForm.name}
                    onChange={(e) => setNewSubForm({ ...newSubForm, name: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price (₹)"
                    value={newSubForm.price}
                    onChange={(e) => setNewSubForm({ ...newSubForm, price: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Comm Fee (₹)"
                    value={newSubForm.commission_fee}
                    onChange={(e) => setNewSubForm({ ...newSubForm, commission_fee: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Time"
                    value={newSubForm.time}
                    onChange={(e) => setNewSubForm({ ...newSubForm, time: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="button button-small button-outline" onClick={() => setAddingSubserviceFor(null)}>
                    Cancel
                  </button>
                  <button type="button" className="button button-small button-gold" onClick={() => handleCreateSubservice(service.id, service)}>
                    Save Package
                  </button>
                </div>
              </div>
            )}

            {/* Subservices Table */}
            <div className="subservices-table-wrap" style={{ marginTop: '12px', overflowX: 'auto' }}>
              <table className="subservices-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px' }}>Sub-Service Package</th>
                    <th style={{ padding: '8px', width: '90px' }}>Est. Time</th>
                    <th style={{ padding: '8px', width: '140px' }}>Price (₹)</th>
                    <th style={{ padding: '8px', width: '140px' }}>Commission Fee (₹)</th>
                    <th style={{ padding: '8px', width: '120px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(service.subcategories || []).map((sub) => {
                    const currentPrice = sub.price ?? 0;
                    const currentComm = sub.commission_fee ?? sub.commissionFee ?? sub.commission ?? service.commission_fee ?? 149;
                    const draftPrice = subPriceDrafts[sub.id] ?? currentPrice;
                    const draftComm = subCommDrafts[sub.id] ?? currentComm;
                    const isPriceModified = Number(draftPrice) !== Number(currentPrice);
                    const isCommModified = Number(draftComm) !== Number(currentComm);
                    const isModified = isPriceModified || isCommModified;

                    return (
                      <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>
                          <strong>{sub.name}</strong>
                          {sub.description && <div style={{ color: '#64748b', fontSize: '12px' }}>{sub.description}</div>}
                        </td>
                        <td style={{ padding: '8px' }}>⏱️ {sub.time || '45 mins'}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>₹</span>
                            <input
                              type="number"
                              min="0"
                              style={{ width: '80px', padding: '4px 6px', border: isPriceModified ? '1px solid #f59e0b' : '1px solid #cbd5e1', borderRadius: '4px' }}
                              value={draftPrice}
                              onChange={(e) => setSubPriceDrafts({ ...subPriceDrafts, [sub.id]: e.target.value })}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#0d9488' }}>₹</span>
                            <input
                              type="number"
                              min="0"
                              style={{ width: '80px', padding: '4px 6px', border: isCommModified ? '1px solid #0d9488' : '1px solid #cbd5e1', borderRadius: '4px' }}
                              value={draftComm}
                              onChange={(e) => setSubCommDrafts({ ...subCommDrafts, [sub.id]: e.target.value })}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className={`button button-small ${isModified ? 'button-gold' : 'button-outline'}`}
                            style={{ marginRight: '6px' }}
                            onClick={() => saveSubPrice(service.id, sub)}
                          >
                            {isModified ? 'Update' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="button button-small button-danger"
                            onClick={() => deleteSubservice(service.id, sub.id)}
                            title={`Delete ${sub.name}`}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
