import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

import { AgGridModule } from 'ag-grid-angular';
import { ClientSideRowModelModule } from 'ag-grid-community';
import { ColDef, Module, ICellRendererParams } from 'ag-grid-community';

import { AddInvoiceComponent } from './add-invoice/add-invoice.component';
import { TabStateService } from '../../../shared/tab-state.service';

@Component({
  selector: 'app-invoices',
  standalone: true,
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    AgGridModule,
    AddInvoiceComponent
  ]
})
export class InvoicesComponent implements OnInit {
  invoices: any[] = [];
  allInvoices: any[] = [];
  loading: boolean = true;

  userRole: string = '';
  currentTab: string = 'All Invoices';
  private latestSearchText: string = '';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };

  showAddInvoice: boolean = false;

  columnDefs: ColDef[] = [];
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true
  };

  modules: Module[] = [ClientSideRowModelModule];

  constructor(
    private http: HttpClient,
    private router: Router,
    private tabService: TabStateService
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const user = localStorage.getItem('user');
    this.userRole = user ? JSON.parse(user).role : '';

    localStorage.removeItem('dateRanges');
    this.dateRange = { start: null, end: null };
    this.invoices = [];

    const endpoint =
      this.userRole === 'Customer'
        ? `${environment.apiBaseUrl}/invoices/my-invoices`
        : `${environment.apiBaseUrl}/invoices`;

    this.http.get<any[]>(endpoint, { headers }).subscribe({
      next: (res) => {
        this.allInvoices = res;
        this.setupColumns(); // 👈 define columns dynamically
        this.invoices = [];

        this.tabService.currentTab$.subscribe(tab => {
          this.currentTab = tab;
          this.filterInvoices();
        });

        this.tabService.searchText$.subscribe(text => {
          this.latestSearchText = text;
          this.filterInvoices();
        });

        this.tabService.refresh$.subscribe(() => {
          const updated = this.tabService.getDateRange('invoices');
          this.dateRange = updated
            ? { start: new Date(updated.start), end: new Date(updated.end) }
            : { start: null, end: null };
          this.filterInvoices();
        });

        if (this.userRole !== 'Customer') {
          this.tabService.openAddInvoice$.subscribe(() => {
            this.showAddInvoice = true;
          });
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Failed to load invoices:', err);
        this.loading = false;
      }
    });
  }

  setupColumns(): void {
    this.columnDefs = [
      { field: 'invoice_id', headerName: 'Invoice ID' },
      { field: 'invoice_number', headerName: 'Invoice Number' },
      ...(this.userRole !== 'Customer' ? [{ field: 'company_name', headerName: 'Company Name' }] : []),
      {
        field: 'amount',
        headerName: 'Amount',
        valueFormatter: p => {
          const amount = parseFloat(p.value);
          return isNaN(amount) ? 'N/A' : `₹${amount.toFixed(2)}`;
        }
      },
      {
        field: 'status',
        headerName: 'Status',
        cellRenderer: (params: ICellRendererParams) => {
          const status = params.value;
          const badgeMap: { [key: string]: string } = {
            Paid: '#22c55e',
            Sent: '#3b82f6',
            Overdue: '#ef4444',
            Pending: '#f59e0b',
            'Partially Paid': '#f97316',
            Unpaid: '#6b7280'
          };
          const color = badgeMap[status] || '#6b7280';
          return `<span style="display:inline-block;padding:1px 8px;font-size:11px;font-weight:700;line-height:1.3;border-radius:9999px;color:#fff;background-color:${color};text-align:center;white-space:nowrap;">${status}</span>`;
        }
      },
      { field: 'due_date', headerName: 'Due Date' },
      { field: 'paid_at', headerName: 'Paid At' }
    ];
  }

  filterInvoices(): void {
    if (!this.dateRange.start || !this.dateRange.end) {
      this.invoices = [];
      return;
    }

    let filtered = [...this.allInvoices];

    if (this.currentTab && this.currentTab !== 'All Invoices') {
      filtered = filtered.filter(invoice =>
        invoice.status?.toLowerCase() === this.currentTab.toLowerCase()
      );
    }

    const searchText = this.latestSearchText.toLowerCase();
    if (searchText) {
      filtered = filtered.filter(invoice =>
        Object.values(invoice).some(val =>
          typeof val === 'string' && val.toLowerCase().includes(searchText)
        )
      );
    }

    filtered = filtered.filter(invoice => {
      const created = new Date(invoice.created_at || invoice.due_date || invoice.paid_at);
      return created >= this.dateRange.start! && created <= this.dateRange.end!;
    });

    this.invoices = filtered;
  }

  onRowClicked(event: any): void {
    const invoiceId = event.data.invoice_id;
    this.router.navigate([`/admin/invoices/${invoiceId}`]);
  }

  openAddInvoice(): void {
    this.showAddInvoice = true;
  }

  closeAddInvoice(): void {
    this.showAddInvoice = false;
  }

  handleInvoiceAdded(newInvoice: any): void {
    this.allInvoices.push(newInvoice);
    this.filterInvoices();
    this.closeAddInvoice();
  }
}
