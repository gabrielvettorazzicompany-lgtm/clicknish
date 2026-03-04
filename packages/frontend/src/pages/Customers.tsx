import { useState, useMemo } from 'react'
import { Search, Upload, Plus, Trash2, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { Button, Pagination, Input, Chip, Spinner } from '@heroui/react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import CustomerFilters from '@/components/customers/CustomerFilters'
import CustomersTable from '@/components/customers/CustomersTable'
import AddCustomerModal from '@/components/customers/AddCustomerModal'
import ManageAccessModal from '@/components/customers/ManageAccessModal'
import EditCustomerModal from '@/components/customers/EditCustomerModal'
import DeleteCustomerModal from '@/components/customers/DeleteCustomerModal'
import { useCustomers } from '@/hooks/useCustomers'
import { useI18n } from '@/i18n'

export default function Customers() {
    const { t } = useI18n()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const {
        filteredCustomers, customers, products, combinedItems,
        searchTerm, setSearchTerm,
        selectedDate, setSelectedDate,
        selectedCustomers,
        loading, saving, error,
        selectedApp, setSelectedApp,
        selectedMarketplace, setSelectedMarketplace,
        showModal, setShowModal,
        showAccessModal, setShowAccessModal,
        showEditModal, setShowEditModal,
        showDeleteConfirm, setShowDeleteConfirm,
        showExportMenu, setShowExportMenu,
        editingCustomer,
        customerToDelete, setCustomerToDelete,
        customerProducts,
        formData, setFormData,
        selectedAppName,
        handleSelectAll, handleSelectCustomer,
        toggleProductSelection, toggleProductAccess,
        handleAddCustomer, handleManageAccess,
        handleSaveAccess,
        handleEditCustomer, handleSaveCustomerEdit,
        handleSendEmail, handleDeleteCustomer, handleDeleteAllSelected,
        handleExportCSV, handleExportPDF,
        formatDate, formatTime
    } = useCustomers()

    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 9

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE))
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredCustomers.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredCustomers, currentPage])

    const handleCombinedChange = (value: string) => {
        const item = combinedItems.find(i => i.id === value)
        if (item) {
            if (item.type === 'app') { setSelectedApp(value); setSelectedMarketplace('') }
            else { setSelectedMarketplace(value); setSelectedApp('') }
        } else {
            setSelectedApp(''); setSelectedMarketplace('')
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#080b14] flex transition-colors duration-200 relative">
            <div className="pointer-events-none fixed inset-0 overflow-hidden dark:block hidden">
                <div className="absolute top-[-80px] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[30%] right-[-60px] w-[400px] h-[400px] rounded-full bg-indigo-500/15 blur-[100px]" />
                <div className="absolute bottom-[10%] left-[5%] w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px]" />
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 overflow-y-auto pt-14 relative z-10">
                    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                {t('customers.title')}
                            </h1>
                            <p className="text-sm text-gray-700 dark:text-gray-400">
                                {t('customers.subtitle')}
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-300 dark:border-gray-800 mb-6">
                            <div className="flex gap-6">
                                <button
                                    className="pb-3 px-1 border-b-2 border-blue-500 text-gray-900 dark:text-gray-100 transition-colors flex items-center gap-2"
                                >
                                    <span className="font-medium text-sm">{t('customers.tabs.all')}</span>
                                    <Chip size="sm" variant="flat" color="secondary">
                                        {customers.length}
                                    </Chip>
                                </button>
                            </div>
                        </div>

                        {/* Search and Actions */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="flex-1">
                                <Input
                                    placeholder={t('customers.search_placeholder')}
                                    value={searchTerm}
                                    onValueChange={setSearchTerm}
                                    startContent={<Search className="w-4 h-4 text-gray-400" />}
                                    variant="bordered"
                                    radius="md"
                                    classNames={{
                                        inputWrapper: 'bg-white dark:bg-white/5 dark:backdrop-blur-xl border-gray-300 dark:border-white/10 hover:border-primary data-[focus=true]:border-primary',
                                        input: 'text-sm text-gray-900 dark:text-gray-100',
                                    }}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedCustomers.length > 0 && (
                                    <Button
                                        variant="bordered"
                                        radius="md"
                                        startContent={<Trash2 className="w-4 h-4" />}
                                        onPress={handleDeleteAllSelected}
                                        className="border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                                    >
                                        {t('customers.actions.delete_selected', { count: selectedCustomers.length })}
                                    </Button>
                                )}
                                <div className="relative">
                                    <Button
                                        variant="bordered"
                                        radius="md"
                                        startContent={<Upload className="w-4 h-4" />}
                                        endContent={<ChevronDown className="w-3.5 h-3.5" />}
                                        onPress={() => setShowExportMenu(!showExportMenu)}
                                        className="border-gray-300 dark:border-white/10 text-gray-900 dark:text-gray-300 bg-white dark:bg-white/5 dark:backdrop-blur-xl"
                                    >
                                        {t('customers.actions.export')}
                                    </Button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#0f1221]/95 dark:backdrop-blur-xl border border-gray-300 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <button
                                                onClick={() => { handleExportCSV(); setShowExportMenu(false) }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-sm text-gray-900 dark:text-gray-300 transition-colors"
                                            >
                                                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                                                <span>{t('customers.actions.export_csv')}</span>
                                            </button>
                                            <button
                                                onClick={() => { handleExportPDF(); setShowExportMenu(false) }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/5 text-sm text-gray-900 dark:text-gray-300 transition-colors border-t border-gray-200 dark:border-white/5"
                                            >
                                                <FileText className="w-4 h-4 text-red-500" />
                                                <span>{t('customers.actions.export_pdf')}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    color="primary"
                                    radius="md"
                                    startContent={<Plus className="w-4 h-4" />}
                                    onPress={() => setShowModal(true)}
                                >
                                    {t('customers.actions.new_customer')}
                                </Button>
                            </div>
                        </div>

                        {/* Filters */}
                        <CustomerFilters
                            combinedItems={combinedItems}
                            selectedApp={selectedApp}
                            selectedMarketplace={selectedMarketplace}
                            selectedDate={selectedDate}
                            onCombinedChange={handleCombinedChange}
                            onDateChange={setSelectedDate}
                        />

                        {/* Table */}
                        <div className="bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-300 dark:border-white/10 rounded-xl overflow-hidden">
                            {loading ? (
                                <div className="p-8 flex justify-center">
                                    <Spinner color="primary" label={t('customers.loading')} labelColor="foreground" />
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center text-red-500 dark:text-red-400">
                                    <p className="font-medium">{error}</p>
                                </div>
                            ) : filteredCustomers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    {t('customers.empty')}
                                </div>
                            ) : (
                                <CustomersTable
                                    customers={paginatedCustomers}
                                    loading={false}
                                    saving={saving}
                                    selectedCustomers={selectedCustomers}
                                    onSelectAll={handleSelectAll}
                                    onSelectCustomer={handleSelectCustomer}
                                    onSendEmail={handleSendEmail}
                                    onManageAccess={handleManageAccess}
                                    onEdit={handleEditCustomer}
                                    onDelete={(customer) => { setCustomerToDelete(customer); setShowDeleteConfirm(true) }}
                                    formatDate={formatDate}
                                    formatTime={formatTime}
                                />
                            )}
                        </div>

                        {/* Pagination */}
                        {!loading && filteredCustomers.length > 0 && (
                            <div className="flex justify-center mt-6">
                                <Pagination
                                    showControls
                                    page={currentPage}
                                    total={totalPages}
                                    onChange={(page) => setCurrentPage(page)}
                                    classNames={{
                                        cursor: 'bg-blue-600 text-white',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {showModal && (
                <AddCustomerModal
                    products={products}
                    saving={saving}
                    formData={formData}
                    onFormChange={setFormData}
                    onToggleProduct={toggleProductSelection}
                    onSubmit={handleAddCustomer}
                    onClose={() => setShowModal(false)}
                />
            )}

            {showAccessModal && editingCustomer && (
                <ManageAccessModal
                    customer={editingCustomer}
                    products={products}
                    saving={saving}
                    customerProducts={customerProducts}
                    onToggleAccess={toggleProductAccess}
                    onSave={handleSaveAccess}
                    onClose={() => setShowAccessModal(false)}
                />
            )}

            {showEditModal && editingCustomer && (
                <EditCustomerModal
                    saving={saving}
                    formData={formData}
                    onFormChange={setFormData}
                    onSave={handleSaveCustomerEdit}
                    onClose={() => setShowEditModal(false)}
                />
            )}

            {showDeleteConfirm && customerToDelete && (
                <DeleteCustomerModal
                    customer={customerToDelete}
                    saving={saving}
                    onConfirm={handleDeleteCustomer}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    )
}
