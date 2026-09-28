/*
 * Script Include: IscanCmdbHealthScanner
 * Client callable: false.
 *
 * CMDB & CSDM Health evidence collector. GENERATED from noviq-cmdb-health
 * scripts/cmdb_health_collector.js by scripts/gen-cmdb-scanner.py - do not
 * edit the spliced check bodies by hand; change the generator's patch list.
 *
 * The 49 check bodies are the collector's own, verbatim: check IDs, queries and
 * semantics unchanged. What differs is only what running in the x_nold_iscan
 * scope requires (each change is a named patch in the generator):
 *   - CFG comes from the x_nold_iscan.cmdb_health.* properties, and the values
 *     used are snapshotted into meta.config.
 *   - TableUtils (global) -> GlideTableHierarchy (scoped).
 *   - Returns {meta, inventory, checks, accessGaps} instead of gs.print().
 *   - addHaving() is used only when available (see having()).
 *   - The offering id sets are capped at maxIterate (the collector left them
 *     unbounded).
 *   - Access denials become not_assessed with "access denied to <table>",
 *     never a zero count - see the guarded constructors in collect().
 *
 * READ-ONLY: GlideRecord/GlideAggregate reads only. No insert/update/delete on
 * any CMDB or platform table - the only writes in this whole feature are the
 * run-keyed rows IscanScanOrchestrator inserts into x_nold_iscan_* tables.
 *
 * Runs in the async worker (as System) - CMDB Health is admin-only to launch,
 * see IscanScanOrchestrator.canLaunch().
 */
var IscanCmdbHealthScanner = Class.create()

IscanCmdbHealthScanner.prototype = {
    initialize: function () {
        // Captured HERE, outside collect(): collect() shadows both names with
        // guarded factories, and a `var` declaration is hoisted over the whole
        // function, so reading the globals from inside collect() would see
        // undefined.
        this._GlideRecord = GlideRecord
        this._GlideAggregate = GlideAggregate
    },

    /**
     * Runs every check and returns the collector's result object.
     * @returns {Object} {meta, inventory, checks:[{id,count,total,samples,note}], accessGaps:[table]}
     */
    collect: function () {
        var RealGR = this._GlideRecord
        var RealGA = this._GlideAggregate
        var DENIAL = IscanTableScanner.prototype.CROSS_SCOPE_DENIAL_SIGNATURE
        var gaps = {}

        function intProp(name, def) {
            var v = parseInt(gs.getProperty('x_nold_iscan.cmdb_health.' + name, String(def)), 10)
            return isNaN(v) ? def : v
        }
        function strProp(name, def) {
            return String(gs.getProperty('x_nold_iscan.cmdb_health.' + name, def) || def)
        }
        // instance_name / glide.buildtag are global properties read from this
        // scope; they only feed meta, never scoring, so a refusal degrades to ''.
        function globalProp(name) {
            try { return gs.getProperty(name) || '' } catch (e) { return '' }
        }

        var CFG = {
            staleDays: intProp('stale_days', 90),
            ticketWindowDays: intProp('ticket_window_days', 90),
            sampleSize: intProp('sample_size', 5),
            maxIterate: intProp('max_iterate', 200000),
            expectedBaAsRel: strProp('expected_ba_as_rel', 'Consumes::Consumed by'),
            systemUsers: strProp('system_users', 'fresh,system,glide.maint,maint').split(',')
                .map(function (u) { return u.trim() })
                .filter(function (u) { return u !== '' }),
        }

        var NOT_RETIRED = 'install_status!=7^ORinstall_statusISEMPTY';
        var TSO_Q = 'service_classification=Technical Service';
        var BSO_Q = 'service_classification=Business Service';
        var out = { meta: {}, inventory: [], checks: [] };

        // ---------- access handling -------------------------------------------
        // A table this scope may not read throws Denied; safe() turns every check
        // still open in that block into "NOT ASSESSED: access denied to <table>",
        // and the table is listed in accessGaps. A denial is never a zero count.
        function Denied(table) {
            this.deniedTable = table
            this.message = 'access denied to ' + table
        }
        Denied.prototype.toString = function () { return this.message }

        function guard(g, t) {
            // A missing table is left alone: the collector's own isTable() guards
            // turn it into a null count (not assessed), exactly as before.
            if (g.isValid() && !g.canRead()) {
                gaps[t] = true
                throw new Denied(t)
            }
            return g
        }
        // The spliced check bodies call `new GlideRecord(t)` / `new
        // GlideAggregate(t)` directly ~30 times. Shadowing both names here gives
        // every one of them the canRead() gate without editing a single check
        // body. A constructor that returns an object makes `new` yield that
        // object, so callers receive the real, guarded record.
        var GlideRecord = function (t) { return guard(new RealGR(t), t) }
        var GlideAggregate = function (t) { return guard(new RealGA(t), t) }

        // Cross-scope-privilege denials do not throw; they surface through
        // getLastErrorMessage() after query() (KB2291532). Same signature
        // IscanTableScanner._detectCrossScopePrivDenial uses.
        function checkCrossScope(g, t) {
            var err = g.getLastErrorMessage ? String(g.getLastErrorMessage() || '') : ''
            if (err && err.indexOf(DENIAL) !== -1) {
                gaps[t] = true
                throw new Denied(t)
            }
        }

        // ---------- helpers (the collector's, scoped) ---------------------------
        function isTable(t) { var g = new RealGR(t); return g.isValid(); }
        function hasField(t, f) { var g = new RealGR(t); return g.isValid() && g.isValidField(f); }
        function daysAgo(n) { var d = new GlideDateTime(); d.addDaysUTC(-n); return d.getValue(); }
        function olderThan(field, days) { return function (g) { g.addQuery(field, '<', daysAgo(days)); }; }
        function newerThan(field, days) { return function (g) { g.addQuery(field, '>=', daysAgo(days)); }; }
        function uniq(a) { var s = {}, r = []; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = 1; r.push(a[i]); } return r; }
        function isCustomName(t) { return /^(u_|x_)/.test(t); }

        // TableUtils is global-only; GlideTableHierarchy is its scoped
        // equivalent. Per c_GlideTableHierarchyScopedAPI.md getAllExtensions()
        // already includes the base table - [base] stays in front (uniq'd) so the
        // result does not depend on that. Indexed by .length so it works whether
        // the platform hands back a JS or a Java array.
        function extensions(base) {
            if (!isTable(base)) return [];
            var ext = new GlideTableHierarchy(base).getAllExtensions();
            var a = [];
            for (var i = 0; i < ext.length; i++) a.push(String(ext[i]));
            return uniq([base].concat(a));
        }

        function count(table, eq, extra) {
            if (!isTable(table)) return null;
            var ga = new GlideAggregate(table);
            if (eq) ga.addEncodedQuery(eq);
            if (extra) extra(ga);
            ga.addAggregate('COUNT');
            ga.query();
            checkCrossScope(ga, table);
            return ga.next() ? parseInt(ga.getAggregate('COUNT'), 10) : 0;
        }

        // meta is built outside safe(); a denied meta count degrades to null
        // (unknown) instead of aborting every check.
        function metaCount(table, eq) {
            try { return count(table, eq); }
            catch (e) { if (e && e.deniedTable) return null; throw e; }
        }

        function samples(table, eq, extra, n) {
            var res = [];
            if (!isTable(table)) return res;
            var gr = new GlideRecord(table);
            if (eq) gr.addEncodedQuery(eq);
            if (extra) extra(gr);
            gr.setLimit(n || CFG.sampleSize);
            gr.query();
            checkCrossScope(gr, table);
            while (gr.next()) res.push(String(gr.getDisplayValue() || gr.getUniqueValue()));
            return res;
        }

        // addHaving() is documented only in the GLOBAL GlideAggregate API
        // (c_GlideAggregateAPI.md), not the scoped one (c_GlideAggregateScopedAPI.md
        // has no match). Use it when it works; otherwise return false and the
        // caller skips COUNT <= 1 groups in its own loop - the same result, at the
        // cost of iterating every group.
        function having(ga) {
            try { ga.addHaving('COUNT', '>', '1'); return true; }
            catch (e) { return false; }
        }

        function add(id, cnt, total, smp, note) {
            out.checks.push({ id: id, count: cnt, total: total, samples: smp || [], note: note || '' });
        }
        function skip(id, why) {
            out.checks.push({ id: id, count: null, total: null, samples: [], note: 'NOT ASSESSED: ' + why });
        }
        // The collector's safe(): one failing check (or block of checks) is
        // recorded as not assessed and never fails the run.
        function safe(ids, fn) {
            ids = [].concat(ids);
            var before = out.checks.length;
            try { fn(); }
            catch (e) {
                var why = e && e.deniedTable ? 'access denied to ' + e.deniedTable : 'error: ' + e;
                var done = {};
                for (var i = before; i < out.checks.length; i++) done[out.checks[i].id] = true;
                for (var j = 0; j < ids.length; j++) if (!done[ids[j]]) skip(ids[j], why);
            }
        }

        function relPairs(parentClasses, childClasses) {
            var pairs = [];
            if (!parentClasses.length || !childClasses.length) return pairs;
            var g = new GlideRecord('cmdb_rel_ci');
            g.addEncodedQuery('parent.sys_class_nameIN' + parentClasses.join(',') +
                              '^child.sys_class_nameIN' + childClasses.join(','));
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) pairs.push({ p: g.getValue('parent'), c: g.getValue('child'), t: String(g.type.name) });
            return pairs;
        }

        function missingFrom(table, eq, set) {
            var r = { missing: 0, total: 0, samples: [] };
            if (!isTable(table)) return null;
            var g = new GlideRecord(table);
            if (eq) g.addEncodedQuery(eq);
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) {
                r.total++;
                if (!set[g.getUniqueValue()]) {
                    r.missing++;
                    if (r.samples.length < CFG.sampleSize) r.samples.push(String(g.getDisplayValue()));
                }
            }
            return r;
        }

        // The collector left this unbounded, loading every matching sys_id into
        // memory. Capped like every other record-by-record loop.
        function idSet(table, eq) {
            var s = {};
            if (!isTable(table)) return s;
            var g = new GlideRecord(table);
            if (eq) g.addEncodedQuery(eq);
            g.setLimit(CFG.maxIterate);
            g.query();
            while (g.next()) s[g.getUniqueValue()] = true;
            return s;
        }

        // sys_store_app only feeds meta; a denial there degrades to "none found".
        function storeApps(term) {
            var r = [];
            if (!isTable('sys_store_app')) return r;
            try {
                var g = new GlideRecord('sys_store_app');
                g.addQuery('name', 'CONTAINS', term);
                g.query();
                while (g.next()) r.push(g.getValue('name') + ' ' + (g.getValue('version') || ''));
            } catch (e) {
                if (!e || !e.deniedTable) throw e;
            }
            return r;
        }

        // ---------- metadata & inventory ------------------------------------------
        var CMDB_TABLES = extensions('cmdb_ci');
        var CUSTOM_CLASSES = CMDB_TABLES.filter(isCustomName);
        var SA_EXT = extensions('cmdb_ci_service_auto');
        var BA_EXT = extensions('cmdb_ci_business_app');
        var IO_EXT = extensions('cmdb_ci_information_object');

        out.meta = {
            instance: globalProp('instance_name'),
            build: globalProp('glide.buildtag') || globalProp('glide.war'),
            generated: new GlideDateTime().getDisplayValue(),
            config: CFG,
            ci_total: metaCount('cmdb_ci', ''),
            ci_active: metaCount('cmdb_ci', NOT_RETIRED),
            rel_total: metaCount('cmdb_rel_ci', ''),
            max_iterate_warning: CFG.maxIterate < 50000 ? 'maxIterate=' + CFG.maxIterate + ' - record-by-record checks may be truncated' : '',
            cmdb_class_count: CMDB_TABLES.length,
            custom_class_count: CUSTOM_CLASSES.length,
            apps: {
                data_foundations_dashboard: storeApps('Data Foundations'),
                service_graph_connectors: storeApps('Service Graph Connector'),
                cmdb_class_models: storeApps('CMDB CI Class Models')
            }
        };

        safe('CSDM_POPULATION', function () {
            out.meta.csdm_population = {
                business_capability: count('cmdb_ci_business_capability', ''),
                business_application: count('cmdb_ci_business_app', NOT_RETIRED),
                information_object: count('cmdb_ci_information_object', ''),
                sdlc_component: count('cmdb_ci_sdlc_component', ''),
                service_instance: count('cmdb_ci_service_auto', NOT_RETIRED),
                dynamic_ci_group: count('cmdb_ci_query_based_service', ''),
                technology_mgmt_service: count('cmdb_ci_service_technical', NOT_RETIRED),
                technology_mgmt_offering: count('service_offering', TSO_Q + '^' + NOT_RETIRED),
                business_service: count('cmdb_ci_service_business', NOT_RETIRED),
                business_offering: count('service_offering', BSO_Q + '^' + NOT_RETIRED),
                legacy_base_service: count('cmdb_ci_service', 'sys_class_name=cmdb_ci_service^' + NOT_RETIRED),
                cmdb_group: count('cmdb_group', ''),
                ai_function: count('cmdb_ci_function_ai', ''),
                software_package_ci: count('cmdb_ci_spkg', NOT_RETIRED)
            };
        });

        safe('INVENTORY', function () {
            var ga = new GlideAggregate('cmdb_ci');
            ga.addEncodedQuery(NOT_RETIRED);
            ga.addAggregate('COUNT');
            ga.groupBy('sys_class_name');
            ga.query();
            var rows = [];
            while (ga.next()) rows.push({ cls: ga.getValue('sys_class_name'), n: parseInt(ga.getAggregate('COUNT'), 10) });
            rows.sort(function (a, b) { return b.n - a.n; });
            out.inventory = rows.slice(0, 40);
        });

        // ---------- Foundation data & consumers -----------------------------------
        safe('FD-01', function () {
            add('FD-01', count('business_unit', 'companyISEMPTY'), count('business_unit', ''),
                samples('business_unit', 'companyISEMPTY'));
        });

        safe('FD-02', function () {
            var ga = new GlideAggregate('cmdb_ci');
            ga.addEncodedQuery(NOT_RETIRED + '^locationISNOTEMPTY');
            ga.addAggregate('COUNT');
            ga.groupBy('location');
            ga.query();
            var used = 0, bad = 0, smp = [];
            while (ga.next()) {
                used++;
                var loc = new GlideRecord('cmn_location');
                if (loc.get(ga.getValue('location')) && loc.parent.nil()) {
                    bad++;
                    if (smp.length < CFG.sampleSize) smp.push(loc.getDisplayValue());
                }
            }
            add('FD-02', bad, used, smp, 'Top-of-hierarchy locations (e.g. regions) legitimately have no parent - review samples.');
        });

        safe('FD-03', function () {
            var ga = new GlideAggregate('cmn_location');
            ga.addAggregate('COUNT');
            ga.groupBy('name');
            var filterDupes = !having(ga);
            ga.query();
            var groups = 0, recs = 0, smp = [];
            while (ga.next()) {
                var c = parseInt(ga.getAggregate('COUNT'), 10);
                if (filterDupes && c <= 1) continue;
                groups++; recs += c;
                if (smp.length < CFG.sampleSize) smp.push(ga.getValue('name') + ' (x' + c + ')');
            }
            add('FD-03', recs, count('cmn_location', ''), smp, groups + ' duplicate name groups');
        });

        safe('FD-04', function () {
            var w = newerThan('opened_at', CFG.ticketWindowDays);
            add('FD-04', count('incident', 'cmdb_ciISEMPTY', w), count('incident', '', w),
                samples('incident', 'cmdb_ciISEMPTY', w), 'incidents opened in last ' + CFG.ticketWindowDays + ' days');
        });

        safe('FD-05', function () {
            var w = newerThan('opened_at', CFG.ticketWindowDays);
            add('FD-05', count('change_request', 'cmdb_ciISEMPTY', w), count('change_request', '', w),
                samples('change_request', 'cmdb_ciISEMPTY', w), 'changes opened in last ' + CFG.ticketWindowDays + ' days');
        });

        safe('FD-06', function () {
            var w = newerThan('opened_at', CFG.ticketWindowDays);
            var q = 'business_serviceISEMPTY^ORcmdb_ciISEMPTY';
            add('FD-06', count('change_request', q, w), count('change_request', '', w), samples('change_request', q, w),
                'with offering populated: ' + count('change_request', 'service_offeringISNOTEMPTY', w));
        });

        safe('FD-07', function () {
            var w = newerThan('opened_at', CFG.ticketWindowDays);
            var q = 'business_serviceISEMPTY^ORcmdb_ciISEMPTY';
            add('FD-07', count('incident', q, w), count('incident', '', w), samples('incident', q, w),
                'with offering populated: ' + count('incident', 'service_offeringISNOTEMPTY', w));
        });

        function brCheck(id, table, nameLike) {
            safe(id, function () {
                var g = new GlideRecord('sys_script');
                g.addQuery('collection', table);
                g.addQuery('name', 'CONTAINS', nameLike);
                g.query();
                var found = 0, active = 0, smp = [];
                while (g.next()) {
                    found++;
                    var a = g.getValue('active');
                    if (a == '1' || a == 'true') active++;
                    smp.push(g.getValue('name') + ' [active=' + a + ']');
                }
                add(id, active > 0 ? 0 : 1, 1, smp,
                    found ? (active ? 'active rule found' : 'rule exists but is inactive') : 'no business rule matching "' + nameLike + '" on ' + table);
            });
        }
        brCheck('FD-08', 'cmdb_ci', 'Create Asset');

        // ---------- Configuration items -------------------------------------------
        safe('CI-01', function () {
            var bad = CUSTOM_CLASSES.filter(function (t) { return !/^u_cmdb_ci_/.test(t) && !/^x_.*cmdb_ci_/.test(t); });
            add('CI-01', bad.length, CUSTOM_CLASSES.length, bad.slice(0, 20),
                CUSTOM_CLASSES.length + ' custom CMDB classes in total: ' + CUSTOM_CLASSES.slice(0, 30).join(', '));
        });

        var customAttr = [];
        safe(['CI-03', 'CI-02'], function () {
            var d = new GlideRecord('sys_dictionary');
            d.addQuery('name', 'IN', CMDB_TABLES.concat(['cmdb']).join(','));
            d.addEncodedQuery('elementSTARTSWITHu_^ORelementSTARTSWITHx_');
            d.query();
            while (d.next()) customAttr.push({ t: d.getValue('name'), e: d.getValue('element') });

            var onOob = customAttr.filter(function (a) { return !isCustomName(a.t); }).length;
            add('CI-03', customAttr.length, null,
                customAttr.slice(0, 20).map(function (a) { return a.t + '.' + a.e; }),
                onOob + ' on OOB classes, ' + (customAttr.length - onOob) + ' on custom classes');

            var byEl = {};
            customAttr.forEach(function (a) { (byEl[a.e] = byEl[a.e] || []).push(a.t); });
            var multi = Object.keys(byEl).filter(function (k) { return byEl[k].length > 1; });
            var root = customAttr.filter(function (a) { return a.t == 'cmdb_ci' || a.t == 'cmdb'; });
            add('CI-02', multi.length + root.length, Object.keys(byEl).length,
                multi.slice(0, 10).map(function (k) { return k + ' -> ' + byEl[k].join(', '); })
                    .concat(root.slice(0, 10).map(function (a) { return a.t + '.' + a.e + ' (root level)'; })),
                multi.length + ' attributes duplicated across classes; ' + root.length + ' defined on cmdb/cmdb_ci root');
        });

        safe('CI-04', function () {
            var itam = uniq(extensions('alm_asset').concat(extensions('cmdb_model')));
            var d = new GlideRecord('sys_dictionary');
            d.addQuery('name', 'IN', itam.join(','));
            d.addEncodedQuery('elementSTARTSWITHu_^ORelementSTARTSWITHx_');
            d.query();
            var n = 0, smp = [];
            while (d.next()) { n++; if (smp.length < 20) smp.push(d.getValue('name') + '.' + d.getValue('element')); }
            add('CI-04', n, null, smp);
        });

        safe('CI-05', function () {
            // OOB values/labels (verify against a PDI of the same release before remediating)
            var OOB = {
                install_status: { '1': 'installed', '2': 'on order', '3': 'in maintenance', '4': 'pending install',
                                  '5': 'pending repair', '6': 'in stock', '7': 'retired', '8': 'stolen', '100': 'absent' },
                operational_status: { '1': 'operational', '2': 'non-operational', '3': 'repair in progress',
                                      '4': 'dr standby', '5': 'ready', '6': 'retired', '7': 'pipeline', '8': 'catalog' }
            };
            // Classes that ship their own OOB install_status list (e.g. Business Application:
            // Pilot / In Production / Under Evaluation / Implementing / Retired) - not customisations.
            var OOB_OVERRIDES = ['cmdb_ci_business_app'];
            var c = new GlideRecord('sys_choice');
            c.addQuery('name', 'IN', CMDB_TABLES.join(','));
            c.addQuery('name', 'NOT IN', OOB_OVERRIDES.join(','));
            c.addQuery('element', 'IN', 'install_status,operational_status');
            c.addQuery('language', 'en');
            c.addQuery('inactive', false);
            c.query();
            var total = 0, added = 0, relabelled = 0, smp = [];
            while (c.next()) {
                total++;
                var el = c.getValue('element'), v = c.getValue('value'), l = String(c.getValue('label') || '').toLowerCase();
                if (!OOB[el].hasOwnProperty(v)) {
                    added++;
                    if (smp.length < 15) smp.push(c.getValue('name') + '.' + el + ' NEW ' + v + ' (' + c.getValue('label') + ')');
                } else if (OOB[el][v] != l) {
                    relabelled++;
                    if (smp.length < 15) smp.push(c.getValue('name') + '.' + el + ' RELABEL ' + v + ' -> ' + c.getValue('label'));
                }
            }
            var upd = count('sys_update_xml', 'nameSTARTSWITHsys_choice_cmdb^nameLIKEstatus');
            add('CI-05', added + relabelled, total, smp,
                added + ' non-OOB values, ' + relabelled + ' relabelled (heuristic); ' + upd +
                ' customer update records touch CMDB status choices; classes with OOB-specific lists skipped: ' + OOB_OVERRIDES.join(', '));
        });

        safe('CI-06', function () {
            var junk = ['localhost', 'localhost.localdomain', 'unknown', 'n/a', 'na', 'none', 'null', 'test', 'default', '-', '.', '0'];
            var q = NOT_RETIRED + '^nameISEMPTY^ORnameIN' + junk.join(',');
            add('CI-06', count('cmdb_ci', q), out.meta.ci_active, samples('cmdb_ci', q),
                'IP-address-only names are not detected here - review manually');
        });

        safe('CI-07', function () {
            var q = NOT_RETIRED + '^model_idISEMPTY^ORmodel_id.sys_class_name!=cmdb_hardware_product_model^ORmodel_id.nameLIKEunknown';
            add('CI-07', count('cmdb_ci_hardware', q), count('cmdb_ci_hardware', NOT_RETIRED), samples('cmdb_ci_hardware', q),
                'empty model: ' + count('cmdb_ci_hardware', NOT_RETIRED + '^model_idISEMPTY'));
        });

        safe('CI-08', function () {
            var o = olderThan('sys_updated_on', CFG.staleDays);
            var design = 'sys_class_nameNOT INcmdb_ci_business_app,cmdb_ci_business_capability,cmdb_ci_information_object,cmdb_ci_business_process';
            add('CI-08', count('cmdb_ci', NOT_RETIRED, o), out.meta.ci_active, samples('cmdb_ci', NOT_RETIRED, o),
                'excluding manually-managed design classes: ' + count('cmdb_ci', NOT_RETIRED + '^' + design, o) +
                ' of ' + count('cmdb_ci', NOT_RETIRED + '^' + design));
        });

        safe('CI-09', function () {
            var q = NOT_RETIRED + '^discovery_sourceISEMPTY';
            add('CI-09', count('cmdb_ci', q), out.meta.ci_active, samples('cmdb_ci', q));
        });

        safe('CI-10', function () {
            var flagged = hasField('cmdb_ci', 'duplicate_of') ? count('cmdb_ci', NOT_RETIRED + '^duplicate_ofISNOTEMPTY') : null;
            var openTasks = isTable('reconcile_duplicate_task') ? count('reconcile_duplicate_task', 'active=true') : null;
            var junkSerial = /^(0+|none|n\/?a|null|unknown|default string|to be filled.*|system serial number|123456789|not specified|chassis serial number)$/i;
            var ga = new GlideAggregate('cmdb_ci_hardware');
            ga.addEncodedQuery(NOT_RETIRED + '^serial_numberISNOTEMPTY');
            ga.addAggregate('COUNT');
            ga.groupBy('serial_number');
            var filterDupes = !having(ga);
            ga.query();
            var serialDup = 0, junk = 0, smp = [];
            while (ga.next()) {
                var s = String(ga.getValue('serial_number')), c = parseInt(ga.getAggregate('COUNT'), 10);
                if (filterDupes && c <= 1) continue;
                if (junkSerial.test(s.trim())) { junk += c; continue; }
                serialDup += c;
                if (smp.length < CFG.sampleSize) smp.push('serial ' + s + ' x' + c);
            }
            add('CI-10', Math.max(flagged || 0, serialDup), out.meta.ci_active, smp,
                'IRE-flagged duplicates: ' + flagged + '; open de-duplication tasks: ' + openTasks +
                '; hardware CIs sharing a serial: ' + serialDup + '; CIs with junk serials: ' + junk);
        });

        safe('CI-11', function () {
            var custom = extensions('cmdb_ci_service').filter(isCustomName);
            var smp = custom.slice(0, 20).map(function (t) { return t + ' (' + count(t, '') + ' records)'; });
            add('CI-11', custom.length, null, smp);
        });

        safe('CI-12', function () {
            var q = NOT_RETIRED + '^locationISEMPTY';
            add('CI-12', count('cmdb_ci_server', q), count('cmdb_ci_server', NOT_RETIRED), samples('cmdb_ci_server', q));
        });

        safe('CI-13', function () {
            var pop = NOT_RETIRED + (hasField('cmdb_ci_hardware', 'virtual') ? '^virtual!=true' : '');
            var q = pop + '^serial_numberISEMPTY';
            add('CI-13', count('cmdb_ci_hardware', q), count('cmdb_ci_hardware', pop), samples('cmdb_ci_hardware', q));
        });

        safe('CI-14', function () {
            var hf = null;
            ['host_name', 'fqdn'].forEach(function (f) { if (!hf && hasField('cmdb_ci_computer', f)) hf = f; });
            if (!hf) { skip('CI-14', 'neither host_name nor fqdn found on cmdb_ci_computer'); return; }
            var g = new GlideRecord('cmdb_ci_computer');
            g.addEncodedQuery(NOT_RETIRED + '^' + hf + 'ISNOTEMPTY^nameISNOTEMPTY');
            g.setLimit(CFG.maxIterate);
            g.query();
            var n = 0, bad = 0, smp = [];
            var shortName = function (x) { return String(x).toLowerCase().split('.')[0]; };
            while (g.next()) {
                n++;
                if (shortName(g.getValue('name')) != shortName(g.getValue(hf))) {
                    bad++;
                    if (smp.length < CFG.sampleSize) smp.push(g.getValue('name') + ' vs ' + g.getValue(hf));
                }
            }
            var noHost = count('cmdb_ci_computer', NOT_RETIRED + '^' + hf + 'ISEMPTY');
            add('CI-14', bad, n, smp, 'compared name with ' + hf + ' (short name, case-insensitive); computers with empty ' + hf + ': ' + noHost +
                (n >= CFG.maxIterate ? '; CAPPED at ' + CFG.maxIterate : ''));
        });

        safe('CI-15', function () {
            var pop = NOT_RETIRED + '^sys_class_nameINSTANCEOFcmdb_ci_hardware^ORsys_class_nameINSTANCEOFcmdb_ci_vm_instance';
            var o = olderThan('sys_updated_on', CFG.staleDays);
            var note = '';
            if (hasField('cmdb_ci', 'last_discovered')) {
                var popN = count('cmdb_ci', pop);
                var neverDisc = count('cmdb_ci', pop + '^last_discoveredISEMPTY');
                note = 'last_discovered older than ' + CFG.staleDays + 'd or empty: ' +
                    count('cmdb_ci', pop + '^last_discoveredISEMPTY^ORlast_discovered<' + daysAgo(CFG.staleDays)) +
                    '; never discovered: ' + neverDisc;
                if (popN && neverDisc == popN) note += ' | NO DISCOVERY EVIDENCE: freshness is based on sys_updated_on only and cannot be trusted';
            }
            add('CI-15', count('cmdb_ci', pop, o), count('cmdb_ci', pop), samples('cmdb_ci', pop, o), note);
        });

        brCheck('CI-16', 'alm_asset', 'Create CI');

        safe('CI-17', function () {
            var ownerField = null;
            ['owner', 'product_owner', 'owned_by'].forEach(function (f) { if (!ownerField && hasField('cmdb_model', f)) ownerField = f; });
            if (!ownerField) { skip('CI-17', 'no owner field found on cmdb_model'); return; }
            var ga = new GlideAggregate('cmdb_ci');
            ga.addEncodedQuery(NOT_RETIRED + '^model_idISNOTEMPTY');
            ga.addAggregate('COUNT');
            ga.groupBy('model_id');
            ga.query();
            var used = 0, bad = 0, smp = [];
            while (ga.next()) {
                used++;
                var m = new GlideRecord('cmdb_model');
                if (m.get(ga.getValue('model_id')) && m.getElement(ownerField).nil()) {
                    bad++;
                    if (smp.length < CFG.sampleSize) smp.push(m.getDisplayValue());
                }
            }
            add('CI-17', bad, used, smp, 'owner field used: cmdb_model.' + ownerField);
        });

        safe('CI-18', function () {
            var pop = TSO_Q + '^' + NOT_RETIRED;
            var q = pop + '^support_groupISEMPTY^ORchange_controlISEMPTY';
            var note = hasField('service_offering', 'managed_by_group')
                ? 'missing managed_by_group: ' + count('service_offering', pop + '^managed_by_groupISEMPTY') : '';
            add('CI-18', count('service_offering', q), count('service_offering', pop), samples('service_offering', q), note);
        });

        safe('CI-19', function () {
            var pop = 'sys_class_nameINcmdb_ci_service,cmdb_ci_service_business,cmdb_ci_service_technical,service_offering^' + NOT_RETIRED;
            var q = pop + '^owned_byISEMPTY';
            add('CI-19', count('cmdb_ci_service', q), count('cmdb_ci_service', pop), samples('cmdb_ci_service', q),
                'application services without owner: ' + count('cmdb_ci_service_auto', NOT_RETIRED + '^owned_byISEMPTY') +
                ' of ' + count('cmdb_ci_service_auto', NOT_RETIRED));
        });

        safe('CI-20', function () {
            var appl = extensions('cmdb_ci_appl');
            var customBa = BA_EXT.filter(isCustomName);
            var suspect = CUSTOM_CLASSES.filter(function (t) {
                return /app/.test(t) && appl.indexOf(t) < 0 && BA_EXT.indexOf(t) < 0;
            });
            var outside = [];
            var o = new GlideRecord('sys_db_object');
            o.addEncodedQuery('nameSTARTSWITHu_^nameLIKEapp');
            o.query();
            while (o.next()) if (CMDB_TABLES.indexOf(o.getValue('name')) < 0) outside.push(o.getValue('name') + ' (non-CMDB)');
            add('CI-20', customBa.length + suspect.length, null,
                customBa.concat(suspect).concat(outside).slice(0, 20),
                'custom BA extensions: ' + customBa.length + '; custom app-like CMDB classes: ' + suspect.length +
                '; app-like non-CMDB custom tables (review): ' + outside.length);
        });

        safe('CI-21', function () {
            var reg = {};
            var ch = new GlideRecord('sys_choice');
            ch.addQuery('name', 'cmdb_ci');
            ch.addQuery('element', 'discovery_source');
            ch.query();
            while (ch.next()) reg[ch.getValue('value')] = true;

            var ga = new GlideAggregate('cmdb_ci');
            ga.addEncodedQuery(NOT_RETIRED);
            ga.addAggregate('COUNT');
            ga.groupBy('discovery_source');
            ga.query();
            var dist = [], unreg = [];
            while (ga.next()) {
                var v = ga.getValue('discovery_source') || '(empty)';
                var c = ga.getAggregate('COUNT');
                dist.push(v + '=' + c);
                if (v != '(empty)' && !reg[v]) unreg.push(v);
            }

            var tms = [];
            var tm = new GlideRecord('sys_transform_map');
            tm.addQuery('target_table', 'IN', CMDB_TABLES.join(','));
            tm.addQuery('active', true);
            tm.query();
            while (tm.next()) {
                var usesIre = /CMDBTransformUtil|IdentificationEngine/.test(String(tm.getValue('script') || ''));
                var sc = new GlideRecord('sys_transform_script');
                if (!usesIre && sc.isValid()) {
                    sc.addQuery('map', tm.getUniqueValue());
                    sc.addQuery('script', 'CONTAINS', 'CMDBTransformUtil');
                    sc.setLimit(1);
                    sc.query();
                    usesIre = sc.hasNext();
                }
                if (!usesIre) tms.push(tm.getValue('name') + ' -> ' + tm.getValue('target_table'));
            }
            var etl = isTable('sys_rte_eb_definition') ? count('sys_rte_eb_definition', '') : null;
            add('CI-21', tms.length + unreg.length, null,
                tms.slice(0, 15).concat(unreg.map(function (u) { return 'unregistered source: ' + u; })),
                'discovery_source distribution: ' + dist.join('; ') +
                ' | direct (non-IRE) transform maps into CMDB: ' + tms.length +
                ' | IntegrationHub ETL/RTE definitions: ' + etl +
                ' | SGC apps: ' + out.meta.apps.service_graph_connectors.length);
        });

        safe('CI-22', function () {
            var arch = isTable('sys_archive') ? count('sys_archive', 'tableIN' + CMDB_TABLES.join(',') + '^active=true') : 0;
            var cdm = 0, cdmTables = [];
            if (isTable('cmdb_data_management_policy')) {
                cdmTables.push('cmdb_data_management_policy');
                cdm = count('cmdb_data_management_policy', hasField('cmdb_data_management_policy', 'active') ? 'active=true' : '') || 0;
            } else {
                var o = new GlideRecord('sys_db_object');
                o.addEncodedQuery('nameSTARTSWITHcmdb_data_management^nameENDSWITH_policy');
                o.query();
                while (o.next()) { cdmTables.push(o.getValue('name')); cdm += count(o.getValue('name'), '') || 0; }
            }
            add('CI-22', (arch > 0 || cdm > 0) ? 0 : 1, 1, [],
                'active CMDB archive rules: ' + arch + '; CMDB Data Manager policy records: ' + cdm +
                (cdmTables.length ? ' (' + cdmTables.join(', ') + ')' : ' (policy table not found - verify manually)'));
        });

        // ---------- Relationships --------------------------------------------------
        safe(['RL-01', 'RL-03'], function () {
            var used = {};
            var ga = new GlideAggregate('cmdb_rel_ci');
            ga.addAggregate('COUNT');
            ga.groupBy('type');
            ga.query();
            while (ga.next()) used[ga.getValue('type')] = parseInt(ga.getAggregate('COUNT'), 10);

            // Base-system relationship type names (not exhaustive). A type is only reported as custom
            // when its creator is not a system user AND its name is not in this list.
            var BASE = ['allocated to::allocated from', 'applicative flow to::applicative flow from', 'backs up::backed up by',
                'cluster of::cluster', 'connected by::connects', 'consumed by::consumes', 'consumes::consumed by',
                'contains::contained by', 'controlled by::controls', 'cools::cooled by', 'defines resources for::gets resources from',
                'depends on::used by', 'detects::detected by', 'distributed by::distributes', 'extends::extended by',
                'exchanges data with::exchanges data with', 'feeds::fed by', 'from template::template for', 'hosted on::hosts',
                'impacts::impacted by', 'implement end point to::implement end point from', 'implements::implemented by',
                'instantiates::instantiated by', 'ip connection::ip connection', 'located in::houses', 'managed by::manages',
                'members::member of', 'monitors::monitored by', 'operationalizes::operationalized by', 'owns::owned by',
                'powered by::powers', 'protected by::protects', 'provided by::provides', 'provides storage for::stored on',
                'provisioned from::provisioned', 'realizes::realized by', 'receives data from::sends data to',
                'redundancy provided by::provides redundancy for', 'registered on::has registered', 'runs on::runs',
                'sends data to::receives data from', 'subscribes to::subscribed by', 'terminated::terminated by',
                'upgrades::upgraded by', 'used by::uses', 'uses::used by', 'virtualized by::virtualizes', 'reference::referenced by'];
            var t = new GlideRecord('cmdb_rel_type');
            t.query();
            var total = 0, custom = [], modified = [], unusedCustom = 0, sysLike = 0;
            while (t.next()) {
                total++;
                var cb = t.getValue('sys_created_by'), ub = t.getValue('sys_updated_by');
                var uses = used[t.getUniqueValue()] || 0;
                var label = t.getValue('name') + ' (used ' + uses + 'x)';
                var isBase = BASE.indexOf(String(t.getValue('name')).toLowerCase()) >= 0;
                if (CFG.systemUsers.indexOf(cb) < 0 && !isBase) { custom.push(label + ' created by ' + cb); if (!uses) unusedCustom++; }
                else if (CFG.systemUsers.indexOf(cb) < 0) sysLike++;
                else if (CFG.systemUsers.indexOf(ub) < 0) modified.push(label + ' updated by ' + ub);
            }
            var deleted = isTable('sys_audit_delete') ? count('sys_audit_delete', 'tablename=cmdb_rel_type') : null;
            var upd = count('sys_update_xml', 'nameSTARTSWITHcmdb_rel_type_');
            add('RL-01', modified.length + (deleted || 0), total, modified.slice(0, 20),
                'HEURISTIC. OOB types edited by non-system users: ' + modified.length +
                '; deleted relationship types in audit: ' + deleted + '; customer update records: ' + upd);
            add('RL-03', custom.length, total, custom.slice(0, 20),
                'HEURISTIC (non-system creator and name not in base list). Unused custom types: ' + unusedCustom +
                '; base-named types created by non-system users (treated as OOB): ' + sysLike + '. Confirm against a PDI.');
        });

        safe('RL-02', function () {
            var q = 'name=cmdb_rel_ci^elementSTARTSWITHu_^ORelementSTARTSWITHx_';
            var smp = [];
            var d = new GlideRecord('sys_dictionary');
            d.addEncodedQuery(q);
            d.query();
            while (d.next()) smp.push(d.getValue('element'));
            add('RL-02', smp.length, null, smp.slice(0, 20));
        });

        safe('RL-04', function () {
            var q = 'parentISEMPTY^ORchildISEMPTY^ORparent.sys_idISEMPTY^ORchild.sys_idISEMPTY';
            add('RL-04', count('cmdb_rel_ci', q), out.meta.rel_total, samples('cmdb_rel_ci', q),
                'Validate the dangling-reference part of this query in a list view before cleanup.');
        });

        safe(['RL-05', 'RL-06'], function () {
            if (!IO_EXT.length) { skip('RL-05', 'information object table not found'); skip('RL-06', 'information object table not found'); return; }
            var pairs = relPairs(BA_EXT, IO_EXT);
            var withBa = {}, withIo = {};
            pairs.forEach(function (x) { withBa[x.c] = true; withIo[x.p] = true; });
            var io = missingFrom('cmdb_ci_information_object', '', withBa);
            add('RL-05', io.missing, io.total, io.samples);
            var ba = missingFrom('cmdb_ci_business_app', NOT_RETIRED, withIo);
            add('RL-06', ba.missing, ba.total, ba.samples);
        });

        var BSO = {}, TSO = {}, offeringSetError = null;
        try { BSO = idSet('service_offering', BSO_Q); TSO = idSet('service_offering', TSO_Q); }
        catch (e) { if (!e || !e.deniedTable) throw e; offeringSetError = e; }

        safe(['RL-07', 'RL-08'], function () {
            if (offeringSetError) throw offeringSetError;
            var pairs = relPairs(['service_offering'], SA_EXT).filter(function (x) { return BSO[x.p]; });
            var asWithBso = {}, bsoWithAs = {}, types = {};
            pairs.forEach(function (x) { asWithBso[x.c] = true; bsoWithAs[x.p] = true; types[x.t] = (types[x.t] || 0) + 1; });
            var typeNote = 'relationship types used: ' + JSON.stringify(types) + ' (CSDM: Depends on::Used by)';
            var as = missingFrom('cmdb_ci_service_auto', NOT_RETIRED, asWithBso);
            add('RL-07', as.missing, as.total, as.samples, typeNote);
            var bso = missingFrom('service_offering', BSO_Q + '^' + NOT_RETIRED, bsoWithAs);
            add('RL-08', bso.missing, bso.total, bso.samples, typeNote);
        });

        safe(['RL-09', 'RL-10', 'RL-11'], function () {
            var pairs = relPairs(BA_EXT, SA_EXT);
            var types = {}, bad = 0, asWithBa = {}, baWithAs = {};
            pairs.forEach(function (x) {
                types[x.t] = (types[x.t] || 0) + 1;
                if (x.t != CFG.expectedBaAsRel) bad++;
                asWithBa[x.c] = true; baWithAs[x.p] = true;
            });
            add('RL-09', bad, pairs.length, [],
                'expected "' + CFG.expectedBaAsRel + '"; types found: ' + JSON.stringify(types));
            var as = missingFrom('cmdb_ci_service_auto', NOT_RETIRED, asWithBa);
            add('RL-10', as.missing, as.total, as.samples);
            var ba = missingFrom('cmdb_ci_business_app', NOT_RETIRED, baWithAs);
            add('RL-11', ba.missing, ba.total, ba.samples,
                'Retired/planned applications may legitimately have no Application Service.');
        });

        safe('RL-12', function () {
            var q = TSO_Q + '^parentISEMPTY';
            add('RL-12', count('service_offering', q), count('service_offering', TSO_Q), samples('service_offering', q),
                'Business offerings without parent: ' + count('service_offering', BSO_Q + '^parentISEMPTY'));
        });

        safe('RL-13', function () {
            var fld = null;
            var d = new GlideRecord('sys_dictionary');
            d.addQuery('name', 'IN', extensions('cmdb_ci_service').join(','));
            d.addQuery('reference', 'cmdb_group');
            d.query();
            if (d.next()) fld = d.getValue('element');
            if (!fld || !hasField('cmdb_ci_query_based_service', fld)) { skip('RL-13', 'no reference to cmdb_group found on Dynamic CI Group'); return; }
            var q = fld + 'ISEMPTY';
            add('RL-13', count('cmdb_ci_query_based_service', q), count('cmdb_ci_query_based_service', ''),
                samples('cmdb_ci_query_based_service', q), 'reference field: ' + fld);
        });

        // ---------- Additional CSDM best-practice checks --------------------------
        safe('BP-01', function () {
            if (offeringSetError) throw offeringSetError;
            var g = new GlideRecord('cmdb_rel_ci');
            g.addEncodedQuery('parent.sys_class_name=service_offering');
            g.setLimit(CFG.maxIterate);
            g.query();
            var perChild = {};
            while (g.next()) {
                if (!TSO[g.getValue('parent')]) continue;
                var c = g.getValue('child');
                perChild[c] = perChild[c] || {};
                perChild[c][g.getValue('parent')] = true;
            }
            var multi = Object.keys(perChild).filter(function (k) { return Object.keys(perChild[k]).length > 1; });
            var smp = multi.slice(0, CFG.sampleSize).map(function (id) {
                var ci = new GlideRecord('cmdb_ci'); return ci.get(id) ? ci.getDisplayValue() + ' (' + ci.getValue('sys_class_name') + ')' : id;
            });
            add('BP-01', multi.length, Object.keys(perChild).length, smp,
                'Direct TSO relationships only; membership via Dynamic CI Groups is not expanded here.');
        });

        safe('BP-02', function () {
            var design = ['cmdb_ci_business_app', 'cmdb_ci_business_capability', 'cmdb_ci_information_object', 'cmdb_ci_sdlc_component'].filter(isTable);
            var q = 'cmdb_ci.sys_class_nameIN' + design.join(',');
            var w = newerThan('opened_at', CFG.ticketWindowDays);
            var inc = count('incident', q, w), chg = count('change_request', q, w);
            add('BP-02', inc + chg, count('incident', '', w) + count('change_request', '', w),
                samples('incident', q, w).concat(samples('change_request', q, w)),
                'incidents: ' + inc + '; changes: ' + chg);
        });

        safe('BP-03', function () {
            var pop = NOT_RETIRED;
            var q = pop + '^discovery_sourceISEMPTY^ORdiscovery_sourceLIKEmanual';
            add('BP-03', count('cmdb_ci_appl', q), count('cmdb_ci_appl', pop), samples('cmdb_ci_appl', q));
        });

        safe('BP-04', function () {
            if (!hasField('cmdb_ci', 'life_cycle_stage')) { skip('BP-04', 'life_cycle_stage not present (pre-Paris?)'); return; }
            var q = NOT_RETIRED + '^life_cycle_stageISEMPTY';
            add('BP-04', count('cmdb_ci', q), out.meta.ci_active, [], 'informational until Life Cycle fields are adopted');
        });

        safe('BP-05', function () {
            var pop = 'sys_class_nameINSTANCEOFcmdb_ci_service^' + NOT_RETIRED;
            var q = 'sys_class_name=cmdb_ci_service^' + NOT_RETIRED;
            add('BP-05', count('cmdb_ci_service', q), count('cmdb_ci', pop), samples('cmdb_ci_service', q),
                'services stored on the generic cmdb_ci_service class instead of Business / Technology Management / Application Service classes');
        });

        safe('BP-06', function () {
            var q = 'sys_class_name=cmdb_ci^' + NOT_RETIRED;
            add('BP-06', count('cmdb_ci', q), out.meta.ci_active, samples('cmdb_ci', q),
                'CIs on the abstract base class have no class-specific identification, attributes or health rules');
        });


        out.accessGaps = Object.keys(gaps).sort();
        return out;
    },

    type: 'IscanCmdbHealthScanner',
}
